/**
 * tube 由来「製品情報」データを SQLite(Prisma) にインポートするスクリプト。
 *
 * 方針（承認済みプラン）:
 *  - 保存方式: ローカル SQLite へ移行（Firebase 廃止）
 *  - 写真: DATA_DIR/製品情報/<folder>/<file> へ「コピー」（元の共有は残す＝バックアップ）
 *  - 紐付け: 製品名(=工程名称) を 子品番マスタ.xlsx で「SHOP6の工程コード」に解決し processCodes に格納
 *  - 取り込みは SHOP6 のみ（SHOP6コードに一致しない製品はスキップ）
 *  - 曖昧（同じ工程名がSHOP6内で複数コードに該当）は候補コードを全格納
 *
 * 実行:
 *   npx tsx scripts/import-products.ts          # ドライラン（DB書込・写真コピーなし）
 *   npx tsx scripts/import-products.ts --apply   # 本実行
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import * as XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const APPLY = process.argv.includes("--apply");

const EXPORT_DIR =
  "\\\\Sv-04\\ﾃﾞｰﾀﾍﾞｰｽ\\製造グループ\\加工チーム\\Antigravity\\新しいフォルダー\\export";
const TARGET_SHOP = "S6";
const PHOTO_SUBDIR = "製品情報"; // DATA_DIR 配下のコピー先ルート

function getDataDir(): string {
  return (process.env.DATA_DIR ?? "./data").replace(/\\/g, "/");
}

function masterPath(): string {
  const dir = (process.env.MASTER_DIR ?? getDataDir()).replace(/\\/g, "/");
  return path.join(dir, "子品番マスタ.xlsx");
}

function createPrisma() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const filename = url.replace(/^file:/, "");
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: filename }) });
}

type AnyRec = Record<string, any>;

function loadJson(name: string): AnyRec[] {
  const p = path.join(EXPORT_DIR, name);
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, "utf-8"));
}

/** 工程名称 → SHOP6 の工程コード集合 */
function buildShop6Map(): Map<string, Set<string>> {
  const buf = readFileSync(masterPath());
  const wb = XLSX.read(buf, { type: "buffer" });
  const raw = XLSX.utils.sheet_to_json<AnyRec>(wb.Sheets[wb.SheetNames[0]], { defval: null });
  const map = new Map<string, Set<string>>();
  for (const r of raw) {
    const shop = r["SHOP"] == null ? "" : String(r["SHOP"]).trim();
    if (shop !== TARGET_SHOP) continue;
    const procName = String(r["工程名称"] ?? "").trim();
    const code = String(r["工程コード"] ?? "").trim();
    if (!procName || !code) continue;
    if (!map.has(procName)) map.set(procName, new Set());
    map.get(procName)!.add(code);
  }
  return map;
}

/** UNC/絶対/相対いずれの写真パスからも <folder>/<file> を取り出す */
function splitPhotoPath(url: string): { folder: string; file: string } | null {
  if (!url) return null;
  const cleaned = url.split("?")[0];
  const parts = cleaned.split(/[\\/]+/).filter(Boolean);
  if (parts.length < 2) return null;
  const file = parts[parts.length - 1];
  const folder = parts[parts.length - 2];
  return { folder, file };
}

function toNewUrl(folder: string, file: string): string {
  return `/api/files/${PHOTO_SUBDIR}/${folder}/${file}`;
}

async function main() {
  const prisma = createPrisma();
  const dataDir = getDataDir();

  const products = loadJson("products.json");
  const templates = loadJson("product_templates.json");
  const defects = loadJson("product_defects.json");

  const shop6Map = buildShop6Map();
  console.log(`子品番マスタ SHOP6 工程名称: ${shop6Map.size} 種`);

  // ── 取り込む製品を決定し、processCodes を解決 ──
  type Prepared = {
    product: AnyRec;
    codes: string[];
    unique: boolean;
  };
  const prepared: Prepared[] = [];
  let skipped = 0;
  for (const p of products) {
    const name = String(p.name ?? "").trim();
    const codeSet = shop6Map.get(name);
    if (!codeSet || codeSet.size === 0) {
      skipped++;
      continue;
    }
    const codes = [...codeSet].sort();
    prepared.push({ product: p, codes, unique: codes.length === 1 });
  }

  const importedProductIds = new Set(prepared.map((x) => x.product.id));

  // ── 写真の収集（取り込む製品＋その欠陥のみ） ──
  const photoRefs = new Set<string>(); // 元パス
  const collect = (u: any) => {
    if (typeof u === "string" && u.trim()) photoRefs.add(u);
  };
  for (const { product: p } of prepared) {
    for (const u of p.photoUrls ?? []) collect(u);
    for (const s of p.specifications ?? []) collect(s?.photoUrl);
    for (const tv of p.templateValues ?? []) {
      collect(tv?.photoUrl);
      collect(tv?.videoUrl);
    }
  }
  const relevantDefects = defects.filter((d) => importedProductIds.has(d.productId));
  for (const d of relevantDefects) for (const u of d.photoUrls ?? []) collect(u);

  // ── 写真コピー計画 ──
  let copyOk = 0;
  let copyMissing = 0;
  const urlRewrite = new Map<string, string>(); // 旧URL -> 新URL
  for (const src of photoRefs) {
    const sp = splitPhotoPath(src);
    if (!sp) {
      console.warn("  パス解析不可(スキップ):", src);
      continue;
    }
    const newUrl = toNewUrl(sp.folder, sp.file);
    urlRewrite.set(src, newUrl);
    const destDir = path.join(dataDir, PHOTO_SUBDIR, sp.folder);
    const dest = path.join(destDir, sp.file);
    // 元ファイルの実在確認（UNCなど絶対パスの場合）
    const srcExists = existsSync(src.split("?")[0]);
    if (!srcExists) {
      copyMissing++;
      continue;
    }
    if (APPLY) {
      await fs.mkdir(destDir, { recursive: true });
      if (!existsSync(dest)) await fs.copyFile(src.split("?")[0], dest);
    }
    copyOk++;
  }

  const rewrite = (u: any): any =>
    typeof u === "string" && urlRewrite.has(u) ? urlRewrite.get(u)! : u;

  // ── DB投入 ──
  let productWrites = 0;
  if (APPLY) {
    // テンプレート（全件）
    for (const t of templates) {
      await prisma.productTemplate.upsert({
        where: { id: t.id },
        update: {
          name: t.name ?? "",
          fields: JSON.stringify(t.fields ?? []),
        },
        create: {
          id: t.id,
          name: t.name ?? "",
          fields: JSON.stringify(t.fields ?? []),
        },
      });
    }

    for (const { product: p, codes } of prepared) {
      // レガシー appliedTemplateIds → appliedTemplateInstances 正規化
      let instances = p.appliedTemplateInstances ?? [];
      if ((!instances || instances.length === 0) && Array.isArray(p.appliedTemplateIds)) {
        instances = p.appliedTemplateIds.map((tid: string) => ({
          instanceId: `legacy-${tid}`,
          templateId: tid,
        }));
      }
      const specifications = (p.specifications ?? []).map((s: AnyRec) => ({
        ...s,
        photoUrl: rewrite(s.photoUrl),
      }));
      const templateValues = (p.templateValues ?? []).map((tv: AnyRec) => ({
        ...tv,
        photoUrl: rewrite(tv.photoUrl),
        videoUrl: rewrite(tv.videoUrl),
      }));
      const photoUrls = (p.photoUrls ?? []).map(rewrite);

      const data = {
        name: String(p.name ?? ""),
        processCodes: JSON.stringify(codes),
        processingNotes: String(p.processingNotes ?? ""),
        photoUrls: JSON.stringify(photoUrls),
        specifications: JSON.stringify(specifications),
        appliedTemplateInstances: JSON.stringify(instances),
        templateValues: JSON.stringify(templateValues),
        isActive: p.isActive !== false,
      };
      await prisma.product.upsert({
        where: { id: p.id },
        update: data,
        create: { id: p.id, ...data },
      });
      productWrites++;
    }

    // 欠陥（取り込む製品のもののみ）
    for (const d of relevantDefects) {
      const photoUrls = (d.photoUrls ?? []).map(rewrite);
      await prisma.productDefect.upsert({
        where: { id: d.id },
        update: {
          productId: d.productId,
          productName: d.productName ?? "",
          occurredAt: new Date(d.occurredAt ?? d.createdAt ?? Date.now()),
          reportedBy: d.reportedBy ?? "",
          description: d.description ?? "",
          photoUrls: JSON.stringify(photoUrls),
        },
        create: {
          id: d.id,
          productId: d.productId,
          productName: d.productName ?? "",
          occurredAt: new Date(d.occurredAt ?? d.createdAt ?? Date.now()),
          reportedBy: d.reportedBy ?? "",
          description: d.description ?? "",
          photoUrls: JSON.stringify(photoUrls),
        },
      });
    }
  }

  // ── レポート ──
  const uniq = prepared.filter((x) => x.unique).length;
  const multi = prepared.length - uniq;
  console.log("\n========================================");
  console.log(APPLY ? "本実行 完了" : "ドライラン（--apply で本実行）");
  console.log("----------------------------------------");
  console.log(`製品: 取り込み ${prepared.length} 件（工程コード一意 ${uniq} / 複数 ${multi}）`);
  console.log(`      スキップ（非SHOP6） ${skipped} 件`);
  console.log(`テンプレート: ${templates.length} 件`);
  console.log(`欠陥: ${relevantDefects.length} 件（取り込む製品に紐づくもの）`);
  console.log(`写真: コピー対象 ${copyOk} 件 / 元ファイル欠損 ${copyMissing} 件`);
  console.log(`コピー先: ${path.join(dataDir, PHOTO_SUBDIR)}`);
  if (APPLY) console.log(`DB書込: 製品 ${productWrites} 件`);
  // 複数コード紐付けサンプル
  const multiSamples = prepared.filter((x) => !x.unique).slice(0, 8);
  if (multiSamples.length) {
    console.log("\n--- 複数コード紐付け（サンプル） ---");
    for (const x of multiSamples) {
      console.log(`  ${x.product.name}  →  ${x.codes.join(", ")}`);
    }
  }
  console.log("========================================");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
