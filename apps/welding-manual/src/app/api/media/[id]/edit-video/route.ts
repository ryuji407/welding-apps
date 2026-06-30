import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import ffmpeg from "fluent-ffmpeg";
import { prisma, getDataDir } from "@/lib/db";

export const maxDuration = 120;

function processVideo(
  inputPath: string,
  outputPath: string,
  rotation: number,
  startTime: number,
  endTime: number | null,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath);

    if (startTime > 0) {
      cmd.inputOptions([`-ss ${startTime}`]);
    }

    const vfParts: string[] = [];
    if (rotation === 90) vfParts.push("transpose=1");
    else if (rotation === 180) vfParts.push("transpose=1,transpose=1");
    else if (rotation === 270) vfParts.push("transpose=2");

    const outputOpts: string[] = [
      "-crf 28",
      "-preset fast",
      "-movflags +faststart",
      "-metadata:s:v rotate=0",
    ];
    if (vfParts.length > 0) outputOpts.push(`-vf ${vfParts.join(",")}`);
    if (endTime !== null) outputOpts.push(`-t ${endTime - startTime}`);

    cmd
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions(outputOpts)
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .run();
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const media = await prisma.mediaFile.findUnique({ where: { id } });
  if (!media) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const rotation: number = body.rotation ?? 0;
  const startTime: number = body.startTime ?? 0;
  const endTime: number | null = body.endTime ?? null;

  if (![0, 90, 180, 270].includes(rotation)) {
    return NextResponse.json({ error: "rotation must be 0/90/180/270" }, { status: 400 });
  }

  const cleanUrl = media.url.split("?")[0];
  const relative = cleanUrl.replace("/api/files/", "");
  const srcPath = path.join(getDataDir(), ...relative.split("/"));

  const tmpId = randomUUID();
  const tmpOut = path.join(tmpdir(), `${tmpId}.mp4`);

  try {
    await processVideo(srcPath, tmpOut, rotation, startTime, endTime);
    const processed = await readFile(tmpOut);
    await writeFile(srcPath, processed);

    const newUrl = `${cleanUrl}?v=${Date.now()}`;
    await prisma.mediaFile.update({ where: { id }, data: { url: newUrl } });

    return NextResponse.json({ url: newUrl });
  } finally {
    unlink(tmpOut).catch(() => {});
  }
}
