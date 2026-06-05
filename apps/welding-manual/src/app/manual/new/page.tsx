import Link from "next/link";
import ManualForm from "@/components/ManualForm";
import MasterPicker from "@/components/MasterPicker";
import { emptyInitial } from "@/lib/constants";
import { findByProcessCode } from "@/lib/master";

export const dynamic = "force-dynamic";

export default async function NewManualPage({
  searchParams,
}: {
  searchParams: Promise<{ processCode?: string; aliases?: string; preselect?: string; addTo?: string }>;
}) {
  const { processCode, aliases: aliasesParam, preselect, addTo } = await searchParams;

  if (!processCode) {
    // 工程追加モード：既に選んでいたコードをチェック済みで表示（自動バリアント選択はしない）
    if (addTo) {
      const addToCodes = addTo.split(",").map((s) => s.trim()).filter(Boolean);
      return <MasterPicker initialSelected={addToCodes} />;
    }
    // スケジュールアプリからの preselect フロー：色品番違いを自動選択
    // 色コード部分（中間3文字）を除いたプレフィックスで検索して全変種をヒットさせる
    // 例: "KO0507-MJA-01-01" → "KO0507" で検索 → E6A/2KA/MJA/E3A 全変種がヒット
    const preselectSearchCode = (() => {
      if (!preselect) return undefined;
      const parts = preselect.split("-");
      return parts.length >= 3 && parts[1].length === 3 ? parts[0] : preselect;
    })();
    return (
      <MasterPicker
        initialSelected={preselect ? [preselect] : []}
        initialFilter={preselectSearchCode ? { processCode: preselectSearchCode, shop: "" } : undefined}
      />
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

  const initial = {
    ...emptyInitial,
    processCode,
    productName: master?.itemName ?? "",
    aliases,
  };

  const allCodes = [{ code: processCode, master }, ...aliasMasters];
  const notFoundCodes = allCodes.filter(({ master: m }) => !m).map(({ code }) => code);
  const foundMasters = allCodes.flatMap(({ master: m }) => (m ? [m] : []));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">マニュアル新規作成</h1>

      <div className="space-y-2">
        <h2 className="text-lg font-bold">基本情報</h2>
        {foundMasters.length > 0 && <MasterTable masters={foundMasters} currentCodes={[processCode, ...aliases]} />}
        {notFoundCodes.map((code) => (
          <div key={code} className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">
              工程コード <code className="rounded bg-amber-100 px-1.5 py-0.5">{code}</code>{" "}
              は子品番マスタに見つかりません。
            </p>
            {code === processCode && (
              <p className="mt-1">
                <Link href="/manual/new" className="text-blue-700 underline">
                  マスタから選び直す
                </Link>
              </p>
            )}
          </div>
        ))}
      </div>

      <ManualForm initial={initial} lockProcessCode />
    </div>
  );
}

function MasterTable({
  masters,
  currentCodes,
}: {
  masters: NonNullable<ReturnType<typeof findByProcessCode>>[];
  currentCodes: string[];
}) {
  const addToHref = `/manual/new?addTo=${encodeURIComponent(currentCodes.join(","))}`;
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 text-sm">
      <div className="flex justify-end border-b border-slate-200 px-4 py-2">
        <Link href={addToHref} className="text-xs text-blue-700 hover:underline">
          工程追加
        </Link>
      </div>
      <table className="w-full">
        <thead className="bg-slate-100 text-left text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2">工程コード</th>
            <th className="px-3 py-2">品目名称</th>
            <th className="px-3 py-2">工程名称</th>
            <th className="px-3 py-2">SHOP</th>
            <th className="px-3 py-2 text-right">CT(秒)</th>
            <th className="px-3 py-2 text-right">人数</th>
            <th className="px-3 py-2 text-right">段取り(秒)</th>
          </tr>
        </thead>
        <tbody>
          {masters.map((m) => (
            <tr key={m.processCode} className="border-t border-slate-200">
              <td className="px-3 py-2 font-mono text-xs font-medium text-blue-700">{m.processCode}</td>
              <td className="px-3 py-2">{m.itemName}</td>
              <td className="px-3 py-2">{m.processName}</td>
              <td className="px-3 py-2">{m.shop ?? "—"}</td>
              <td className="px-3 py-2 text-right">{m.cycleTime ?? "—"}</td>
              <td className="px-3 py-2 text-right">{m.workerCount ?? "—"}</td>
              <td className="px-3 py-2 text-right">{m.setupTime ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
