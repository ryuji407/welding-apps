import { NextResponse } from "next/server";
import { getDistinctShops, isMasterAvailable } from "@/lib/master";

export async function GET() {
  if (!isMasterAvailable()) {
    return NextResponse.json({ available: false, shops: [] });
  }
  return NextResponse.json({ available: true, shops: getDistinctShops() });
}
