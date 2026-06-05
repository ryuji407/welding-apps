import "server-only";
import * as XLSX from "xlsx";
import { statSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getDataDir } from "./db";

export type MasterRow = {
  itemCode: string;       // 品目コード
  itemName: string;       // 品目名称
  processCode: string;    // 工程コード
  processName: string;    // 工程名称
  shop: string | null;    // SHOP
  usageCount: number | null;   // 使用数
  setupTime: number | null;    // 段取り時間
  cycleTime: number | null;    // サイクルタイム
  workerCount: number | null;  // 作業人数
  obsolete: string | null;     // 廃番
  equipment: string | null;    // 設備
  equipment2: string | null;   // 設備2
};

const MASTER_FILE = "子品番マスタ.xlsx";

type Cache = {
  mtimeMs: number;
  rows: MasterRow[];
};

let cache: Cache | null = null;

function masterPath(): string {
  return path.join(getDataDir(), MASTER_FILE);
}

function loadMaster(): MasterRow[] {
  const file = masterPath();
  if (!existsSync(file)) return [];
  const stat = statSync(file);
  if (cache && cache.mtimeMs === stat.mtimeMs) {
    return cache.rows;
  }
  const buf = readFileSync(file);
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
  });
  const rows: MasterRow[] = raw.map((r) => ({
    itemCode: String(r["品目コード"] ?? "").trim(),
    itemName: String(r["品目名称"] ?? "").trim(),
    processCode: String(r["工程コード"] ?? "").trim(),
    processName: String(r["工程名称"] ?? "").trim(),
    shop: r["SHOP"] == null ? null : String(r["SHOP"]).trim(),
    usageCount: typeof r["使用数"] === "number" ? r["使用数"] : null,
    setupTime: typeof r["段取り時間"] === "number" ? r["段取り時間"] : null,
    cycleTime:
      typeof r["サイクルタイム"] === "number" ? r["サイクルタイム"] : null,
    workerCount: typeof r["作業人数"] === "number" ? r["作業人数"] : null,
    obsolete: r["廃番"] == null ? null : String(r["廃番"]).trim(),
    equipment: r["設備"] == null ? null : String(r["設備"]).trim(),
    equipment2: r["設備2"] == null ? null : String(r["設備2"]).trim(),
  }));
  cache = { mtimeMs: stat.mtimeMs, rows };
  return rows;
}

export function getMasterRows(): MasterRow[] {
  return loadMaster();
}

export function findByProcessCode(processCode: string): MasterRow | null {
  return loadMaster().find((r) => r.processCode === processCode) ?? null;
}

export type MasterFilter = {
  itemName?: string;
  processCode?: string;
  processName?: string;
  shop?: string;
  excludeObsolete?: boolean;
};

function ciIncludes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function searchMaster(
  filter: MasterFilter,
  limit = 200,
): { total: number; rows: MasterRow[] } {
  const all = loadMaster();
  const matched: MasterRow[] = [];
  for (const r of all) {
    if (filter.excludeObsolete && r.obsolete) continue;
    if (filter.itemName && !ciIncludes(r.itemName, filter.itemName)) continue;
    if (filter.processCode && !ciIncludes(r.processCode, filter.processCode))
      continue;
    if (filter.processName && !ciIncludes(r.processName, filter.processName))
      continue;
    if (filter.shop && r.shop !== filter.shop) continue;
    matched.push(r);
  }
  return { total: matched.length, rows: matched.slice(0, limit) };
}

export function getDistinctShops(): string[] {
  const set = new Set<string>();
  for (const r of loadMaster()) {
    if (r.shop) set.add(r.shop);
  }
  return [...set].sort();
}

export function isMasterAvailable(): boolean {
  return existsSync(masterPath());
}
