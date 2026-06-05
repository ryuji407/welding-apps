import { NextRequest, NextResponse } from "next/server";
import { searchMaster, type MasterFilter } from "@/lib/master";

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
  const limit = Math.min(Number(sp.get("limit") ?? 200), 1000);
  const result = searchMaster(filter, limit);
  return NextResponse.json(result);
}
