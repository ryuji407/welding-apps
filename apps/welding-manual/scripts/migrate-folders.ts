/**
 * フォルダ構成移行スクリプト
 *
 * 旧: uploads/{processCode}/{kind}/{UUID}.jpg
 * 新: マニュアル/{processCode}/{日本語kind}/{UUID}.jpg
 *     (jigのみ) マニュアル/{processCode}/治具工程/工程{N}/{UUID}.jpg
 *
 * 実行: npx tsx scripts/migrate-folders.ts
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const KIND_FOLDER: Record<string, string> = {
  layout:  "全体レイアウト",
  wagon:   "ワゴン積載",
  jig:     "治具工程",
  video:   "動画",
  program: "プログラム",
  notes:   "注意点",
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

async function main() {
  const prisma = createPrisma();
  const dataDir = getDataDir();

  // 全 MediaFile を jigStep の stepNumber も含めて取得
  const mediaFiles = await prisma.mediaFile.findMany({
    include: {
      jigStep: { select: { stepNumber: true } },
    },
  });

  console.log(`\n対象 MediaFile 件数: ${mediaFiles.length}`);
  let moved = 0;
  let skipped = 0;
  let errors = 0;

  for (const media of mediaFiles) {
    // 旧構造 /api/files/uploads/... のみ対象
    if (!media.url.startsWith("/api/files/uploads/")) {
      console.log(`  スキップ（移行済みか対象外）: ${media.url}`);
      skipped++;
      continue;
    }

    // URL をパース: /api/files/uploads/{code}/{kind}/{filename}
    const withoutPrefix = media.url.replace("/api/files/uploads/", "");
    const slashIdx = withoutPrefix.indexOf("/");
    const slashIdx2 = withoutPrefix.indexOf("/", slashIdx + 1);
    if (slashIdx < 0 || slashIdx2 < 0) {
      console.error(`  パース不能: ${media.url}`);
      errors++;
      continue;
    }

    const code = withoutPrefix.slice(0, slashIdx);
    const kind = withoutPrefix.slice(slashIdx + 1, slashIdx2);
    const filename = withoutPrefix.slice(slashIdx2 + 1);
    const kindFolder = KIND_FOLDER[kind] ?? kind;

    // 旧ファイルパス
    const oldFilePath = path.join(dataDir, "uploads", code, kind, filename);

    // 新URLベース・新ファイルパスを決定
    let newUrlBase: string;
    if (kind === "jig" && media.jigStep) {
      const stepFolder = `工程${media.jigStep.stepNumber}`;
      newUrlBase = `マニュアル/${code}/治具工程/${stepFolder}`;
    } else {
      newUrlBase = `マニュアル/${code}/${kindFolder}`;
    }

    const newFilePath = path.join(dataDir, ...newUrlBase.split("/"), filename);
    const newUrl = `/api/files/${newUrlBase}/${filename}`;

    // 新ディレクトリを作成
    await fs.mkdir(path.dirname(newFilePath), { recursive: true });

    // ファイルを移動（rename → 失敗時は copy+delete）
    try {
      await fs.rename(oldFilePath, newFilePath);
    } catch {
      try {
        await fs.copyFile(oldFilePath, newFilePath);
        await fs.unlink(oldFilePath);
      } catch (e2) {
        console.error(`  ファイル移動失敗: ${oldFilePath}`, e2);
        errors++;
        continue;
      }
    }

    // DB の url を更新
    await prisma.mediaFile.update({
      where: { id: media.id },
      data: { url: newUrl },
    });

    console.log(`  移動: ${media.url}`);
    console.log(`    → ${newUrl}`);
    moved++;
  }

  console.log(`\n========================================`);
  console.log(`完了: ${moved} 件移動, ${skipped} 件スキップ, ${errors} 件エラー`);
  console.log(`========================================`);
  console.log(`\n旧フォルダ (uploads/) が空になっていれば手動で削除できます:`);
  console.log(`  ${path.join(dataDir, "uploads")}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
