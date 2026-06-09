import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120; // 動画アップロード・圧縮の最大処理時間（秒）
import { writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { prisma, getDataDir } from "@/lib/db";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";

const IMAGE_MAX_PX = 1920;  // 最長辺の上限（px）
const IMAGE_QUALITY = 80;   // JPEG品質
const VIDEO_MAX_WIDTH = 1280;  // 動画の最大横幅（px）
const VIDEO_MAX_HEIGHT = 720;  // 動画の最大縦幅（px）
const VIDEO_CRF = 28;          // 動画品質（低いほど高品質・大容量。18〜28が実用範囲）

/** ffmpegで動画を圧縮してバッファで返す */
function compressVideo(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        `-vf scale='min(${VIDEO_MAX_WIDTH},iw)':'-2'`,  // 横幅を上限以内に、縦は自動
        `-vf scale='-2':'min(${VIDEO_MAX_HEIGHT},ih)'`, // 縦幅も同様に制限
        `-crf ${VIDEO_CRF}`,
        "-preset fast",
        "-movflags +faststart",  // Web再生向け（モバイルで先頭から再生可能）
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

const ALLOWED_KINDS = new Set(["layout", "wagon", "notes", "jig", "program", "video"]);
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;  // 25MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB

/** kind（英語）→ 日本語フォルダ名のマッピング */
const KIND_FOLDER: Record<string, string> = {
  layout:  "全体レイアウト",
  wagon:   "ワゴン積載",
  jig:     "治具工程",
  video:   "動画",
  program: "プログラム",
  notes:   "注意点",
};

/** ルートフォルダ名 */
const BASE_FOLDER = "マニュアル";

/**
 * 保存先フォルダを決定する。
 * 全ファイルを マニュアル/{processCode}/{日本語kind}/ 以下にまとめることで
 * アプリなしでも工程コード別に参照でき、移行しやすい構造にする。
 * jig は 治具工程/工程{N}/ のようにステップごとにサブフォルダを分ける。
 *
 * フォールバック: processCode が特定できない場合は マニュアル/{manualId}/{kind}/
 */
async function resolveUploadDir(
  kind: string,
  processCode: string | null,
  manualId: string | null,
  jigStepId: string | null,
): Promise<{ dir: string; urlBase: string }> {
  const dataDir = getDataDir();
  const kindFolder = KIND_FOLDER[kind] ?? kind;

  // 1. processCode が直接渡された場合（新規作成中も含む）
  if (processCode) {
    const safeCode = processCode.replace(/[^a-zA-Z0-9_\-]/g, "_");
    const dir = path.join(dataDir, BASE_FOLDER, safeCode, kindFolder);
    return { dir, urlBase: `${BASE_FOLDER}/${safeCode}/${kindFolder}` };
  }

  // 2. jigStepId のみの場合 → DB から processCode・stepNumber を取得
  if (jigStepId) {
    const step = await prisma.jigProcessStep.findUnique({
      where: { id: jigStepId },
      select: { stepNumber: true, manual: { select: { processCode: true } } },
    });
    const code = step?.manual?.processCode;
    if (code) {
      const safeCode = code.replace(/[^a-zA-Z0-9_\-]/g, "_");
      const stepFolder = `工程${step!.stepNumber}`;
      const dir = path.join(dataDir, BASE_FOLDER, safeCode, "治具工程", stepFolder);
      return { dir, urlBase: `${BASE_FOLDER}/${safeCode}/治具工程/${stepFolder}` };
    }
  }

  // 3. manualId のみの場合 → DB から processCode を取得
  if (manualId) {
    const manual = await prisma.manual.findUnique({
      where: { id: manualId },
      select: { processCode: true },
    });
    const code = manual?.processCode;
    if (code) {
      const safeCode = code.replace(/[^a-zA-Z0-9_\-]/g, "_");
      const dir = path.join(dataDir, BASE_FOLDER, safeCode, kindFolder);
      return { dir, urlBase: `${BASE_FOLDER}/${safeCode}/${kindFolder}` };
    }
    // フォールバック: processCode 不明時は manualId フォルダ
    const dir = path.join(dataDir, BASE_FOLDER, manualId, kindFolder);
    return { dir, urlBase: `${BASE_FOLDER}/${manualId}/${kindFolder}` };
  }

  throw new Error("processCode / manualId / jigStepId のいずれかが必要です");
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");
  const manualId = form.get("manualId") ? String(form.get("manualId")) : null;
  const jigStepId = form.get("jigStepId") ? String(form.get("jigStepId")) : null;
  const processCode = form.get("processCode") ? String(form.get("processCode")) : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "fileがありません" }, { status: 400 });
  }
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ error: "kindが不正です" }, { status: 400 });
  }
  const maxBytes = file.type.startsWith("video/") ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    const limit = file.type.startsWith("video/") ? "100MB" : "25MB";
    return NextResponse.json({ error: `ファイルサイズが大きすぎます (${limit}上限)` }, { status: 400 });
  }
  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    return NextResponse.json({ error: "画像または動画ファイルのみアップロード可能です" }, { status: 400 });
  }
  if (kind !== "video" && file.type.startsWith("video/")) {
    return NextResponse.json({ error: "動画はkind=videoで送信してください" }, { status: 400 });
  }
  if (kind === "jig" && !jigStepId) {
    return NextResponse.json({ error: "jigStepIdが必要です" }, { status: 400 });
  }
  if (kind === "program" && !processCode) {
    return NextResponse.json({ error: "processCodeが必要です" }, { status: 400 });
  }
  if (!processCode && !manualId && !jigStepId) {
    return NextResponse.json({ error: "processCode / manualId / jigStepId のいずれかが必要です" }, { status: 400 });
  }

  const isImage = file.type.startsWith("image/");

  // 画像はリサイズ・JPEG変換、動画はffmpegで圧縮
  let buffer: Buffer;
  let ext: string;
  if (isImage) {
    const raw = Buffer.from(await file.arrayBuffer());
    buffer = await sharp(raw)
      .resize({ width: IMAGE_MAX_PX, height: IMAGE_MAX_PX, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: IMAGE_QUALITY })
      .toBuffer();
    ext = ".jpg";
  } else {
    // 動画: 一時ファイルに書き出し → ffmpeg圧縮 → バッファ読み込み → 一時ファイル削除
    const tmpId = randomUUID();
    const tmpInput = path.join(tmpdir(), `${tmpId}_in${path.extname(file.name) || ".mp4"}`);
    const tmpOutput = path.join(tmpdir(), `${tmpId}_out.mp4`);
    try {
      await writeFile(tmpInput, Buffer.from(await file.arrayBuffer()));
      await compressVideo(tmpInput, tmpOutput);
      buffer = await import("node:fs/promises").then((fs) => fs.readFile(tmpOutput));
    } finally {
      await unlink(tmpInput).catch(() => {});
      await unlink(tmpOutput).catch(() => {});
    }
    ext = ".mp4";
  }

  const safeName = `${randomUUID()}${ext}`;

  let uploadDir: string;
  let urlBase: string;
  try {
    ({ dir: uploadDir, urlBase } = await resolveUploadDir(kind, processCode, manualId, jigStepId));
  } catch {
    return NextResponse.json({ error: "保存先の特定に失敗しました" }, { status: 500 });
  }

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, safeName), buffer);
  const url = `/api/files/${urlBase}/${safeName}`;

  // processCode ベースのアップロード（新規作成中）は MediaFile レコード不要
  if (!manualId && !jigStepId) {
    return NextResponse.json({ url });
  }

  // manualId / jigStepId が確定している場合は MediaFile に記録
  const targetManualId =
    manualId ??
    (await prisma.jigProcessStep.findUnique({
      where: { id: jigStepId! },
      select: { manualId: true },
    }))?.manualId;

  if (!targetManualId) {
    return NextResponse.json({ error: "manualが見つかりません" }, { status: 404 });
  }

  const media = await prisma.mediaFile.create({
    data: {
      url,
      filename: file.name,
      mimeType: isImage ? "image/jpeg" : "video/mp4",
      kind,
      manualId: kind === "jig" ? null : targetManualId,
      jigStepId: kind === "jig" ? jigStepId : null,
    },
  });

  return NextResponse.json({ id: media.id, url: media.url });
}
