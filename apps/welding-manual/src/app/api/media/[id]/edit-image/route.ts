import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma, getDataDir } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const media = await prisma.mediaFile.findUnique({ where: { id } });
  if (!media) return NextResponse.json({ error: "not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const raw = Buffer.from(await file.arrayBuffer());
  const processed = await sharp(raw)
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  // ?v=... を除いたクリーンな URL からファイルパスを解決
  const cleanUrl = media.url.split("?")[0];
  const relative = cleanUrl.replace("/api/files/", "");
  const filePath = path.join(getDataDir(), ...relative.split("/"));

  await writeFile(filePath, processed);

  const newUrl = `${cleanUrl}?v=${Date.now()}`;
  await prisma.mediaFile.update({ where: { id }, data: { url: newUrl } });

  return NextResponse.json({ url: newUrl });
}
