// 製品情報の画像アップロード。
// クライアント側で圧縮済みの画像を受け取り、DATA_DIR/製品情報/<folder>/ に保存する
// （マニュアル本体と保存場所・配信ルールを統一。配信は /api/files 経由）。
// folder は basename のみ使用。
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "@/lib/db";

const PHOTO_SUBDIR = "製品情報";

const MAX_FILES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB（圧縮済み前提）

export async function POST(req: NextRequest) {
  const folder = path.basename(req.nextUrl.searchParams.get("folder") || "misc");
  const form = await req.formData();
  const files = form.getAll("photos").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `一度にアップロードできるのは${MAX_FILES}枚までです` }, { status: 400 });
  }
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "画像ファイルのみアップロード可能です" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "ファイルサイズが大きすぎます（最大5MB）" }, { status: 413 });
    }
  }

  const dir = path.join(getDataDir(), PHOTO_SUBDIR, folder);
  try {
    await mkdir(dir, { recursive: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `フォルダ作成失敗: ${msg}` }, { status: 500 });
  }

  const urls: string[] = [];
  for (const file of files) {
    const ext = path.extname(file.name) || ".jpg";
    const filename = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
    urls.push(`/api/files/${PHOTO_SUBDIR}/${folder}/${filename}`);
  }

  return NextResponse.json({ urls });
}
