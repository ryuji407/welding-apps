import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filePath: string[] }> },
) {
  const { filePath } = await params;

  const dataDir = path.resolve(getDataDir());
  const requested = path.resolve(path.join(dataDir, ...filePath));

  // パストラバーサル防止
  if (!requested.startsWith(dataDir + path.sep) && requested !== dataDir) {
    return new NextResponse("Not found", { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(requested);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(requested).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".avi": "video/x-msvideo",
  };
  const contentType = mimeMap[ext] ?? "application/octet-stream";

  return new NextResponse(buffer.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
