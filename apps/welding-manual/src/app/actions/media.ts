"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { unlinkUploadedFile } from "@/lib/uploads";

export async function deleteMedia(mediaId: string, processCode: string) {
  const media = await prisma.mediaFile.findUnique({ where: { id: mediaId } });
  if (!media) return;

  await prisma.mediaFile.delete({ where: { id: mediaId } });
  await unlinkUploadedFile(media.url);

  revalidatePath(`/manual/${processCode}`);
}
