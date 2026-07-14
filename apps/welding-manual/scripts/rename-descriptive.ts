/**
 * 既存アップロードファイルを「工程コード_内容」形式の分かりやすいファイル名にリネームする。
 *
 * 例: マニュアル/AR0008-000-01-01/ワゴン積載/eba3....jpg
 *     → マニュアル/AR0008-000-01-01/ワゴン積載/AR0008-000-01-01_ワゴン積載.jpg
 *
 * 対象: Manual の単一スロット系（layout/wagon/notes/video）と
 *       EnvironmentBlock.stepPhotos（プログラム写真）、Program.photoUrl
 * MediaFile（jig等のギャラリー系）は現状データが無いため対象外。
 *
 * 実行: npx tsx scripts/rename-descriptive.ts        (確認のみ、リネームしない)
 *       npx tsx scripts/rename-descriptive.ts --apply (実際にリネームする)
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

const KIND_FOLDER: Record<string, string> = {
  layout: "全体レイアウト",
  wagon: "ワゴン積載",
  notes: "注意点",
  video: "動画",
};

function getDataDir(): string {
  return (process.env.DATA_DIR ?? "./data").replace(/\\/g, "/");
}

function createPrisma() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const filename = url.replace(/^file:/, "");
  const adapter = new PrismaBetterSqlite3({ url: filename });
  return new PrismaClient({ adapter });
}

function safeCodeFolder(processCode: string): string {
  return processCode.replace(/[^a-zA-Z0-9_\-]/g, "_");
}

function sanitizeFilenamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "_");
}

/** /api/files/... URLをファイルパスに変換する（?v=... は除去） */
function urlToPath(dataDir: string, url: string): string {
  const relative = url.split("?")[0].replace("/api/files/", "");
  return path.join(dataDir, ...relative.split("/"));
}

async function renameFile(oldPath: string, newPath: string, label: string): Promise<boolean> {
  if (oldPath === newPath) {
    console.log(`  変更なし: ${label}`);
    return false;
  }
  const exists = await fs.stat(oldPath).catch(() => null);
  if (!exists) {
    console.log(`  ファイルが見つかりません（スキップ）: ${oldPath}`);
    return false;
  }
  console.log(`  ${APPLY ? "リネーム" : "リネーム予定"}: ${path.basename(oldPath)} → ${path.basename(newPath)}  [${label}]`);
  if (APPLY) {
    await fs.mkdir(path.dirname(newPath), { recursive: true });
    await fs.rename(oldPath, newPath);
  }
  return true;
}

async function main() {
  const prisma = createPrisma();
  const dataDir = getDataDir();
  let renamed = 0;

  // 1. Manual の単一スロット系フィールド
  const manuals = await prisma.manual.findMany({
    select: { id: true, processCode: true, layoutPhotoUrl: true, wagonPhotoUrl: true, notesPhotoUrl: true, workVideoUrl: true },
  });

  for (const manual of manuals) {
    const code = safeCodeFolder(manual.processCode);
    const fields: Array<["layoutPhotoUrl" | "wagonPhotoUrl" | "notesPhotoUrl" | "workVideoUrl", string, string | null]> = [
      ["layoutPhotoUrl", "layout", manual.layoutPhotoUrl],
      ["wagonPhotoUrl", "wagon", manual.wagonPhotoUrl],
      ["notesPhotoUrl", "notes", manual.notesPhotoUrl],
      ["workVideoUrl", "video", manual.workVideoUrl],
    ];

    for (const [field, kind, url] of fields) {
      if (!url || !url.startsWith("/api/files/")) continue;
      const oldPath = urlToPath(dataDir, url);
      const ext = path.extname(oldPath);
      const baseName = sanitizeFilenamePart(`${code}_${KIND_FOLDER[kind]}`);
      const newPath = path.join(path.dirname(oldPath), `${baseName}${ext}`);
      const changed = await renameFile(oldPath, newPath, `${manual.processCode} / ${KIND_FOLDER[kind]}`);
      if (changed) {
        renamed++;
        const relDir = path.relative(dataDir, path.dirname(newPath)).split(path.sep).join("/");
        const newUrl = `/api/files/${relDir}/${baseName}${ext}?v=${Date.now()}`;
        if (APPLY) {
          await prisma.manual.update({ where: { id: manual.id }, data: { [field]: newUrl } });
        }
      }
    }
  }

  // 2. EnvironmentBlock.stepPhotos（プログラム写真） / Program.photoUrl
  const blocks = await prisma.environmentBlock.findMany({
    select: {
      id: true,
      environment: true,
      stepPhotos: true,
      manual: { select: { processCode: true } },
      programs: { select: { id: true, stepNumber: true, robots: true, photoUrl: true } },
    },
  });

  for (const block of blocks) {
    const code = safeCodeFolder(block.manual.processCode);
    const stepPhotos = JSON.parse(block.stepPhotos || "{}") as Record<string, string>;
    let stepPhotosChanged = false;

    for (const [stepNumber, url] of Object.entries(stepPhotos)) {
      if (!url || !url.startsWith("/api/files/")) continue;
      const oldPath = urlToPath(dataDir, url);
      const ext = path.extname(oldPath);
      const baseName = sanitizeFilenamePart(`${code}_${block.environment}_プログラム${stepNumber}`);
      const newPath = path.join(path.dirname(oldPath), `${baseName}${ext}`);
      const changed = await renameFile(oldPath, newPath, `${block.manual.processCode} / ${block.environment} / 工程${stepNumber}`);
      if (changed) {
        renamed++;
        const relDir = path.relative(dataDir, path.dirname(newPath)).split(path.sep).join("/");
        stepPhotos[stepNumber] = `/api/files/${relDir}/${baseName}${ext}?v=${Date.now()}`;
        stepPhotosChanged = true;
      }
    }

    if (stepPhotosChanged && APPLY) {
      await prisma.environmentBlock.update({
        where: { id: block.id },
        data: { stepPhotos: JSON.stringify(stepPhotos) },
      });
    }

    for (const program of block.programs) {
      if (!program.photoUrl || !program.photoUrl.startsWith("/api/files/")) continue;
      const robots = JSON.parse(program.robots || "[]") as string[];
      const robot = robots[0] ?? "";
      const oldPath = urlToPath(dataDir, program.photoUrl);
      const ext = path.extname(oldPath);
      const baseName = sanitizeFilenamePart(`${code}_${block.environment}_プログラム${program.stepNumber}_${robot}`);
      const newPath = path.join(path.dirname(oldPath), `${baseName}${ext}`);
      const changed = await renameFile(oldPath, newPath, `${block.manual.processCode} / ${block.environment} / 工程${program.stepNumber} / ${robot}`);
      if (changed) {
        renamed++;
        const relDir = path.relative(dataDir, path.dirname(newPath)).split(path.sep).join("/");
        const newUrl = `/api/files/${relDir}/${baseName}${ext}?v=${Date.now()}`;
        if (APPLY) {
          await prisma.program.update({ where: { id: program.id }, data: { photoUrl: newUrl } });
        }
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`${APPLY ? "リネーム完了" : "確認完了（--apply で実際にリネームされます）"}`);
  console.log(`対象: ${renamed} 件`);
  console.log(`========================================`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
