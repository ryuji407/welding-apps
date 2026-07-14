import { unlink, rm } from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "@/lib/db";

/** アップロード時に発行した processCode を安全なフォルダ名に変換する（route.ts と同じロジック） */
export function safeCodeFolder(processCode: string): string {
  return processCode.replace(/[^a-zA-Z0-9_\-]/g, "_");
}

/** /api/files/... 形式のURLを実ファイルパスに解決し削除する。ファイルが既に無い場合は無視する */
export async function unlinkUploadedFile(url: string | null | undefined): Promise<void> {
  if (!url || !url.startsWith("/api/files/")) return;
  const relative = url.split("?")[0].replace("/api/files/", "");
  const filePath = path.join(getDataDir(), ...relative.split("/"));
  try {
    await unlink(filePath);
  } catch {
    // ファイルが既にない場合は無視
  }
}

/** マニュアル1件分のアップロードフォルダ（マニュアル/{processCode}/）を丸ごと削除する */
export async function removeManualUploadDir(processCode: string): Promise<void> {
  const dir = path.join(getDataDir(), "マニュアル", safeCodeFolder(processCode));
  await rm(dir, { recursive: true, force: true }).catch(() => {});
}
