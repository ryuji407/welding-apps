/**
 * 孤立ファイル削除スクリプト
 *
 * DB上のどのレコードからも参照されていない画像・動画ファイルを
 * マニュアル/ フォルダ以下から削除する（写真の差し替え・削除時にファイルだけが
 * 残ってしまっていた過去分のクリーンアップ用）。
 *
 * 実行: npx tsx scripts/cleanup-orphan-files.ts        (確認のみ、削除しない)
 *       npx tsx scripts/cleanup-orphan-files.ts --apply (実際に削除する)
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const APPLY = process.argv.includes("--apply");

function getDataDir(): string {
  return (process.env.DATA_DIR ?? "./data").replace(/\\/g, "/");
}

function createPrisma() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const filename = url.replace(/^file:/, "");
  const adapter = new PrismaBetterSqlite3({ url: filename });
  return new PrismaClient({ adapter });
}

/** /api/files/... 形式のURLをマニュアルフォルダからの相対パスに変換する */
function urlToRelativePath(url: string): string | null {
  if (!url.startsWith("/api/files/")) return null;
  return decodeURIComponent(url.split("?")[0].replace("/api/files/", ""));
}

async function walk(dir: string, base: string, out: string[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await walk(abs, rel, out);
    } else {
      out.push(rel);
    }
  }
}

async function main() {
  const prisma = createPrisma();
  const dataDir = getDataDir();
  const manualRoot = path.join(dataDir, "マニュアル");

  const referenced = new Set<string>();

  const manuals = await prisma.manual.findMany({
    select: { layoutPhotoUrl: true, wagonPhotoUrl: true, notesPhotoUrl: true, workVideoUrl: true },
  });
  for (const m of manuals) {
    for (const u of [m.layoutPhotoUrl, m.wagonPhotoUrl, m.notesPhotoUrl, m.workVideoUrl]) {
      const rel = u ? urlToRelativePath(u) : null;
      if (rel) referenced.add(rel);
    }
  }

  const blocks = await prisma.environmentBlock.findMany({
    select: { stepPhotos: true, programs: { select: { photoUrl: true } } },
  });
  for (const b of blocks) {
    const stepPhotos = JSON.parse(b.stepPhotos || "{}") as Record<string, string>;
    for (const u of Object.values(stepPhotos)) {
      const rel = u ? urlToRelativePath(u) : null;
      if (rel) referenced.add(rel);
    }
    for (const p of b.programs) {
      const rel = p.photoUrl ? urlToRelativePath(p.photoUrl) : null;
      if (rel) referenced.add(rel);
    }
  }

  const mediaFiles = await prisma.mediaFile.findMany({ select: { url: true } });
  for (const mf of mediaFiles) {
    const rel = urlToRelativePath(mf.url);
    if (rel) referenced.add(rel);
  }

  console.log(`DB上の参照ファイル数: ${referenced.size}`);

  let allFiles: string[] = [];
  try {
    await walk(manualRoot, "マニュアル", allFiles);
  } catch (e) {
    console.error(`フォルダ読み込み失敗: ${manualRoot}`, e);
    await prisma.$disconnect();
    return;
  }

  const orphans = allFiles.filter((rel) => !referenced.has(rel));

  console.log(`フォルダ内ファイル数: ${allFiles.length}`);
  console.log(`孤立ファイル数: ${orphans.length}`);

  let freedBytes = 0;
  for (const rel of orphans) {
    const abs = path.join(dataDir, ...rel.split("/"));
    const stat = await fs.stat(abs).catch(() => null);
    if (stat) freedBytes += stat.size;
    console.log(`  ${APPLY ? "削除" : "削除予定"}: ${rel} (${stat ? (stat.size / 1024).toFixed(1) : "?"} KB)`);
    if (APPLY) {
      await fs.unlink(abs).catch((e) => console.error(`    削除失敗: ${e}`));
    }
  }

  console.log(`\n========================================`);
  console.log(`${APPLY ? "削除完了" : "確認完了（--apply で実際に削除されます）"}`);
  console.log(`対象: ${orphans.length} 件, 合計 ${(freedBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`========================================`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
