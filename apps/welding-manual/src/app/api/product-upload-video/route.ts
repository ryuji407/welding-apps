// 製品情報の動画アップロード。
// 一時ファイルに書き出し → ffmpeg で H.264/CRF28 に圧縮 → DATA_DIR/製品情報/<folder>/ へ保存。
// 圧縮失敗時は元ファイルをそのままコピー。配信はマニュアル本体と統一し /api/files 経由。
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink, copyFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { getDataDir } from "@/lib/db";

const PHOTO_SUBDIR = "製品情報";

if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

export const maxDuration = 300;

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500MB（圧縮前の元動画）
const VIDEO_MAX_WIDTH = 1280;  // 720p
const VIDEO_MAX_HEIGHT = 720;  // 720p

function compressVideo(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        // 1280x720 以内に収まるよう縦横比を保って縮小し、libx264向けに偶数サイズへ丸める
        `-vf scale='min(${VIDEO_MAX_WIDTH},iw)':'min(${VIDEO_MAX_HEIGHT},ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`,
        "-crf 28",
        "-b:a 128k",
        "-movflags +faststart",
        "-preset fast",
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

export async function POST(req: NextRequest) {
  const folder = path.basename(req.nextUrl.searchParams.get("folder") || "misc");
  const form = await req.formData();
  const file = form.get("video");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });
  }
  if (!file.type.startsWith("video/")) {
    return NextResponse.json({ error: "動画ファイルのみアップロード可能です" }, { status: 400 });
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: "ファイルサイズが大きすぎます（動画は最大500MB）" }, { status: 413 });
  }

  const dir = path.join(getDataDir(), PHOTO_SUBDIR, folder);
  try {
    await mkdir(dir, { recursive: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `保存先フォルダを作成できません: ${msg}` }, { status: 500 });
  }

  const origExt = path.extname(file.name) || ".mp4";
  const tmpInput = path.join(tmpdir(), `product_video_${randomUUID()}${origExt}`);
  await writeFile(tmpInput, Buffer.from(await file.arrayBuffer()));

  try {
    if (ffmpegStatic) {
      const outputFilename = `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp4`;
      try {
        await compressVideo(tmpInput, path.join(dir, outputFilename));
        return NextResponse.json({ url: `/api/files/${PHOTO_SUBDIR}/${folder}/${outputFilename}` });
      } catch (err) {
        console.error("[product-video] 圧縮失敗、元ファイルをそのまま保存:", err);
      }
    }

    // ffmpeg なし or 圧縮失敗 → 元ファイルをそのままコピー
    const fallbackFilename = `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${origExt}`;
    await copyFile(tmpInput, path.join(dir, fallbackFilename));
    return NextResponse.json({ url: `/api/files/${PHOTO_SUBDIR}/${folder}/${fallbackFilename}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `動画の保存に失敗しました: ${msg}` }, { status: 500 });
  } finally {
    await unlink(tmpInput).catch(() => {});
  }
}
