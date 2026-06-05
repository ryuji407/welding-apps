"use server";

import { revalidatePath } from "next/cache";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma, getDataDir } from "@/lib/db";

export async function deleteMedia(mediaId: string, processCode: string) {
  const media = await prisma.mediaFile.findUnique({ where: { id: mediaId } });
  if (!media) return;

  await prisma.mediaFile.delete({ where: { id: mediaId } });

  // /api/files/uploads/... 形式のURLからファイルパスを解決
  if (media.url.startsWith("/api/files/")) {
    const relative = media.url.replace("/api/files/", "");
    const filePath = path.join(getDataDir(), ...relative.split("/"));
    try {
      await unlink(filePath);
    } catch {
      // ファイルが既にない場合は無視
    }
  }

  revalidatePath(`/manual/${processCode}`);
}
