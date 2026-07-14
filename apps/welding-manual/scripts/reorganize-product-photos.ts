/**
 * tube から取り込んだ「製品情報」の写真・動画を、工程コードごとのフォルダに整理し直す。
 *
 * 現状: import-products.ts が元のtube側フォルダ名（templates等）のままコピーしたため、
 *       DATA_DIR/製品情報/templates/ に全製品の写真がまとまって置かれている。
 * 変更後: DATA_DIR/製品情報/<先頭工程コード>/<file> に移動し、DB上のURLも書き換える。
 *       （processCodes が複数ある場合は processCodes[0] を代表フォルダとする）
 *
 * 実行:
 *   npx tsx scripts/reorganize-product-photos.ts          # ドライラン
 *   npx tsx scripts/reorganize-product-photos.ts --apply   # 本実行
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const APPLY = process.argv.includes("--apply");
const PHOTO_SUBDIR = "製品情報";

function getDataDir(): string {
  return (process.env.DATA_DIR ?? "./data").replace(/\\/g, "/");
}

function safeCodeFolder(processCode: string): string {
  return processCode.replace(/[^a-zA-Z0-9_\-]/g, "_");
}

function createPrisma() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const filename = url.replace(/^file:/, "");
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: filename }) });
}

async function main() {
  const prisma = createPrisma();
  const dataDir = getDataDir();
  const products = await prisma.product.findMany();

  let moved = 0;
  let missing = 0;
  let skippedNoCode = 0;
  let productsUpdated = 0;
  const perFolderCount = new Map<string, number>();

  for (const p of products) {
    const codes: string[] = JSON.parse(p.processCodes || "[]");
    if (codes.length === 0) {
      skippedNoCode++;
      continue;
    }
    const folder = safeCodeFolder(codes[0]);

    let changed = false;
    const rewrite = (u: string | null | undefined): string | null | undefined => {
      if (!u || !u.startsWith("/api/files/")) return u;
      const rel = u.replace(/^\/api\/files\//, "");
      const parts = rel.split("/");
      const file = parts[parts.length - 1];
      const srcRel = parts.join("/");
      const destRel = `${PHOTO_SUBDIR}/${folder}/${file}`;
      if (srcRel === destRel) return u; // 既に整理済み

      const srcPath = path.join(dataDir, ...srcRel.split("/"));
      const destDir = path.join(dataDir, PHOTO_SUBDIR, folder);
      const destPath = path.join(destDir, file);

      if (!existsSync(srcPath)) {
        missing++;
        return u;
      }
      if (APPLY) {
        // 直接は awaitできないのでここでは処理せず、後段でファイル操作する
      }
      moved++;
      perFolderCount.set(folder, (perFolderCount.get(folder) ?? 0) + 1);
      changed = true;
      return `/api/files/${destRel}`;
    };

    const photoUrls: string[] = JSON.parse(p.photoUrls || "[]");
    const specifications: any[] = JSON.parse(p.specifications || "[]");
    const templateValues: any[] = JSON.parse(p.templateValues || "[]");

    const newPhotoUrls = photoUrls.map((u) => rewrite(u) ?? u);
    const newSpecifications = specifications.map((s) => ({ ...s, photoUrl: rewrite(s.photoUrl) }));
    const newTemplateValues = templateValues.map((t) => ({
      ...t,
      photoUrl: rewrite(t.photoUrl),
      videoUrl: rewrite(t.videoUrl),
    }));

    if (!changed) continue;

    // 実ファイル移動（mkdir + rename）
    if (APPLY) {
      const doMove = async (oldUrl: string | null | undefined, newUrl: string | null | undefined) => {
        if (!oldUrl || !newUrl || oldUrl === newUrl) return;
        const oldRel = oldUrl.replace(/^\/api\/files\//, "");
        const newRel = newUrl.replace(/^\/api\/files\//, "");
        const srcPath = path.join(dataDir, ...oldRel.split("/"));
        const destPath = path.join(dataDir, ...newRel.split("/"));
        if (!existsSync(srcPath)) return;
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        if (!existsSync(destPath)) {
          await fs.rename(srcPath, destPath);
        }
      };
      for (let i = 0; i < photoUrls.length; i++) await doMove(photoUrls[i], newPhotoUrls[i]);
      for (let i = 0; i < specifications.length; i++) await doMove(specifications[i].photoUrl, newSpecifications[i].photoUrl);
      for (let i = 0; i < templateValues.length; i++) {
        await doMove(templateValues[i].photoUrl, newTemplateValues[i].photoUrl);
        await doMove(templateValues[i].videoUrl, newTemplateValues[i].videoUrl);
      }

      await prisma.product.update({
        where: { id: p.id },
        data: {
          photoUrls: JSON.stringify(newPhotoUrls),
          specifications: JSON.stringify(newSpecifications),
          templateValues: JSON.stringify(newTemplateValues),
        },
      });
    }
    productsUpdated++;
  }

  console.log("========================================");
  console.log(APPLY ? "本実行 完了" : "ドライラン（--apply で本実行）");
  console.log("----------------------------------------");
  console.log(`移動対象ファイル参照: ${moved} 件`);
  console.log(`元ファイルが見つからない参照: ${missing} 件`);
  console.log(`processCodesが空でスキップした製品: ${skippedNoCode} 件`);
  console.log(`更新対象製品: ${productsUpdated} 件`);
  console.log(`工程コードフォルダ別 件数（上位20）:`);
  const sorted = [...perFolderCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [folder, count] of sorted) console.log(`  ${folder}: ${count}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
