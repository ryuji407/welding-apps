import { NextRequest, NextResponse } from "next/server";
import { searchMaster, type MasterFilter } from "@/lib/master";
import { getManualRegistryInfo } from "@/lib/manual";
import { getProductNameMapAction } from "@/app/actions/products";

function ciIncludes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const filter: MasterFilter = {
    itemName: sp.get("itemName") ?? undefined,
    processCode: sp.get("processCode") ?? undefined,
    processName: sp.get("processName") ?? undefined,
    shop: sp.get("shop") ?? undefined,
    excludeObsolete: sp.get("excludeObsolete") === "1",
  };
  for (const k of Object.keys(filter) as (keyof MasterFilter)[]) {
    if (filter[k] === "") delete filter[k];
  }
  const workName = sp.get("workName")?.trim() || undefined;
  const limit = Math.min(Number(sp.get("limit") ?? 200), 1000);

  // 登録済み判定・作業名検索・作業名表示のため、既存マニュアル/製品の 工程コード→作業名 マップを取得
  const mode = sp.get("mode") === "product" ? "product" : "manual";
  const { registeredCodes, nameMap } =
    mode === "product"
      ? await getProductNameMapAction().then((m) => ({ registeredCodes: Object.keys(m), nameMap: m }))
      : await getManualRegistryInfo();
  const registeredSet = new Set(registeredCodes);

  // 作業名で絞り込む場合は、マスタ側の絞り込み結果を広めに取得してから作業名で二次絞り込みする
  const { total: rawTotal, rows: rawRows } = searchMaster(filter, workName ? 5000 : limit);
  const annotated = rawRows.map((r) => ({
    ...r,
    registered: registeredSet.has(r.processCode),
    workName: nameMap[r.processCode] ?? null,
  }));

  if (!workName) {
    return NextResponse.json({ total: rawTotal, rows: annotated });
  }

  const filtered = annotated.filter((r) => r.workName && ciIncludes(r.workName, workName));
  return NextResponse.json({ total: filtered.length, rows: filtered.slice(0, limit) });
}
