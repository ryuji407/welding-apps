import Link from "next/link";
import { Suspense } from "react";
import MasterPicker from "@/components/MasterPicker";
import View from "@/features/products/views/products/ProductNewPage";
import { findByProcessCode } from "@/lib/master";

export const metadata = { title: "製品登録" };
export const dynamic = "force-dynamic";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ processCode?: string; aliases?: string; preselect?: string; addTo?: string }>;
}) {
  const { processCode, aliases: aliasesParam, preselect, addTo } = await searchParams;

  if (!processCode) {
    // 工程追加モード：既に選んでいたコードをチェック済みで表示（自動バリアント選択はしない）
    if (addTo) {
      const addToCodes = addTo.split(",").map((s) => s.trim()).filter(Boolean);
      return (
        <MasterPicker
          initialSelected={addToCodes}
          basePath="/products/new"
          proceedLabel="選択した工程で製品を登録"
          mode="product"
        />
      );
    }
    // 工程表アプリ（SHOP6リンク）からの preselect フロー：色品番違いを自動選択
    if (preselect) {
      const parts = preselect.split("-");
      const preselectSearchCode = parts.length >= 3 && parts[1].length === 3 ? parts[0] : preselect;
      return (
        <MasterPicker
          initialSelected={[preselect]}
          initialFilter={{ shop: "" }}
          autoSelectSearchCode={preselectSearchCode}
          basePath="/products/new"
          proceedLabel="選択した工程で製品を登録"
          mode="product"
        />
      );
    }
    // 通常の新規登録（製品名を自分で入力）
    return (
      <Suspense>
        <View />
      </Suspense>
    );
  }

  const aliases = aliasesParam
    ? aliasesParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const master = findByProcessCode(processCode);
  const aliasMasters = aliases.map((code) => ({
    code,
    master: findByProcessCode(code),
  }));

  const allCodes = [{ code: processCode, master }, ...aliasMasters];
  const notFoundCodes = allCodes.filter(({ master: m }) => !m).map(({ code }) => code);
  const foundMasters = allCodes.flatMap(({ master: m }) => (m ? [m] : []));

  return (
    <Suspense>
      <View
        initialProcessCode={processCode}
        initialAliases={aliases}
        defaultName={master?.itemName ?? ""}
        masterInfo={
          (foundMasters.length > 0 || notFoundCodes.length > 0) && (
            <div className="space-y-2">
              {foundMasters.length > 0 && (
                <MasterTable masters={foundMasters} currentCodes={[processCode, ...aliases]} />
              )}
              {notFoundCodes.map((code) => (
                <div key={code} className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  工程コード <code className="rounded bg-amber-100 px-1.5 py-0.5">{code}</code> は子品番マスタに見つかりません。
                </div>
              ))}
            </div>
          )
        }
      />
    </Suspense>
  );
}

function MasterTable({
  masters,
  currentCodes,
}: {
  masters: NonNullable<ReturnType<typeof findByProcessCode>>[];
  currentCodes: string[];
}) {
  const addToHref = `/products/new?addTo=${encodeURIComponent(currentCodes.join(","))}`;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 text-xs">
      <div className="flex justify-end border-b border-slate-200 px-3 py-1.5">
        <Link href={addToHref} className="text-blue-700 hover:underline">
          工程追加
        </Link>
      </div>
      <table className="w-full">
        <thead className="bg-slate-100 text-left text-slate-500">
          <tr>
            <th className="px-3 py-1.5">工程コード</th>
            <th className="px-3 py-1.5">品目名称</th>
            <th className="px-3 py-1.5">工程名称</th>
            <th className="px-3 py-1.5">SHOP</th>
          </tr>
        </thead>
        <tbody>
          {masters.map((m) => (
            <tr key={m.processCode} className="border-t border-slate-200">
              <td className="px-3 py-1.5 font-mono font-medium text-blue-700">{m.processCode}</td>
              <td className="px-3 py-1.5">{m.itemName}</td>
              <td className="px-3 py-1.5">{m.processName}</td>
              <td className="px-3 py-1.5">{m.shop ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
