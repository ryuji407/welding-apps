// 製品情報の写真・動画配信（tube-manual server.js の GET /uploads/:folder/:filename 互換）
// Firestore には /uploads/<folder>/<filename> 形式の相対URLが保存されているため、
// welding-manual 側でも同じパスで SHOP3 ネットワーク共有から配信する。
import { NextRequest } from "next/server";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { PRODUCT_PHOTO_DIR } from "@/lib/productPhotoDir";

const VIDEO_MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
};
const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function streamFile(filePath: string, start?: number, end?: number) {
  const nodeStream =
    start !== undefined
      ? createReadStream(filePath, { start, end })
      : createReadStream(filePath);
  return Readable.toWeb(nodeStream) as ReadableStream;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ folder: string; filename: string }> },
) {
  const p = await params;
  // basename でパストラバーサル防止（server.js と同じ）
  const folder = path.basename(decodeURIComponent(p.folder));
  const filename = path.basename(decodeURIComponent(p.filename));
  const filePath = path.join(PRODUCT_PHOTO_DIR, folder, filename);

  if (!existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }

  const ext = path.extname(filename).toLowerCase();

  if (ext in VIDEO_MIME) {
    // 動画: Range リクエスト対応（シーク機能のため必須）
    const contentType = VIDEO_MIME[ext];
    const fileSize = statSync(filePath).size;
    const range = req.headers.get("range");

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
      return new Response(streamFile(filePath, start, end), {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(end - start + 1),
          "Content-Type": contentType,
        },
      });
    }
    return new Response(streamFile(filePath), {
      status: 200,
      headers: {
        "Content-Length": String(fileSize),
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
      },
    });
  }

  // 画像
  const mime = IMAGE_MIME[ext] ?? "image/jpeg";
  return new Response(streamFile(filePath), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
