"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type MasterRow = {
  itemName: string;
  processCode: string;
  processName: string;
  shop: string | null;
  cycleTime: number | null;
  workerCount: number | null;
  obsolete: string | null;
};

type Filters = {
  itemName: string;
  processName: string;
  processCode: string;
  shop: string;
};

const PRIORITY_SHOPS = ["S1", "S2", "S3", "S4", "S6", "S7", "塗装", "組立"];

export default function MasterPicker({
  initialSelected = [],
  initialFilter,
}: {
  initialSelected?: string[];
  initialFilter?: Partial<Filters>;
} = {}) {
  const [shops, setShops] = useState<string[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [showAllShops, setShowAllShops] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    itemName: "",
    processName: "",
    processCode: "",
    shop: "S4",
    ...initialFilter,
  });
  const [excludeObsolete, setExcludeObsolete] = useState(true);
  const [rows, setRows] = useState<MasterRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const didAutoSelect = useRef(false);

  useEffect(() => {
    if (didAutoSelect.current || initialSelected.length !== 1 || rows.length === 0) return;
    didAutoSelect.current = true;
    const code = initialSelected[0];
    const parts = code.split("-");
    if (parts.length >= 3 && parts[1].length === 3) {
      const prefix = parts[0];
      const suffix = parts.slice(2).join("-");
      const variants = rows
        .filter((r) => {
          const p = r.processCode.split("-");
          return p.length >= 3 && p[1].length === 3 && p[0] === prefix && p.slice(2).join("-") === suffix;
        })
        .map((r) => r.processCode);
      if (variants.length > 0) setSelected(variants);
    }
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/master/shops")
      .then((r) => r.json())
      .then((d) => {
        setAvailable(d.available);
        setShops(d.shops ?? []);
      })
      .catch(() => setAvailable(false));
  }, []);

  const hasAnyFilter = Object.values(filters).some((v) => v.trim() !== "");

  useEffect(() => {
    if (!hasAnyFilter) {
      setRows([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v.trim()) params.set(k, v.trim());
    }
    if (excludeObsolete) params.set("excludeObsolete", "1");

    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/master/search?${params.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [filters, excludeObsolete, hasAnyFilter]);

  function update(key: keyof Filters, v: string) {
    setFilters((f) => ({ ...f, [key]: v }));
  }

  function colorVariants(code: string): string[] {
    const parts = code.split("-");
    if (parts.length >= 3 && parts[1].length === 3) {
      const prefix = parts[0];
      const suffix = parts.slice(2).join("-");
      return rows
        .filter((r) => {
          const p = r.processCode.split("-");
          return (
            p.length >= 3 &&
            p[1].length === 3 &&
            p[0] === prefix &&
            p.slice(2).join("-") === suffix
          );
        })
        .map((r) => r.processCode);
    }
    return [code];
  }

  function toggleRow(code: string) {
    const variants = colorVariants(code);
    setSelected((prev) => {
      const isSelected = prev.includes(code);
      return isSelected
        ? prev.filter((c) => !variants.includes(c))
        : [...prev, ...variants.filter((c) => !prev.includes(c))];
    });
  }

  const proceedHref = (() => {
    if (selected.length === 0) return null;
    const [primary, ...rest] = selected;
    return rest.length > 0
      ? `/manual/new?processCode=${encodeURIComponent(primary)}&aliases=${encodeURIComponent(rest.join(","))}`
      : `/manual/new?processCode=${encodeURIComponent(primary)}`;
  })();

  const priorityShops = PRIORITY_SHOPS.filter((s) => shops.includes(s));
  const otherShops = shops.filter((s) => !PRIORITY_SHOPS.includes(s));

  if (available === false) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-bold">子品番マスタが見つかりません</p>
        <p className="mt-1">
          <code className="rounded bg-amber-100 px-1.5 py-0.5">
            C:\Users\MARK\マニュアルデータ置き場\子品番マスタ.xlsx
          </code>{" "}
          を配置してください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-bold">工程絞り込み</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {(["itemName", "processName", "processCode"] as const).map((key) => (
            <FilterInput
              key={key}
              label={{ itemName: "品目名称", processName: "工程名称", processCode: "工程コード" }[key]}
              value={filters[key]}
              onChange={(v) => update(key, v)}
            />
          ))}
        </div>

        <div className="mt-4 space-y-1 text-sm">
          <span className="font-medium text-slate-700">SHOP</span>
          <div className="flex flex-wrap gap-1.5">
            <ShopButton
              label="全て"
              active={filters.shop === ""}
              onClick={() => update("shop", "")}
            />
            {priorityShops.map((s) => (
              <ShopButton
                key={s}
                label={s}
                active={filters.shop === s}
                onClick={() => update("shop", s)}
              />
            ))}
            {otherShops.length > 0 && (
              <>
                {showAllShops &&
                  otherShops.map((s) => (
                    <ShopButton
                      key={s}
                      label={s}
                      active={filters.shop === s}
                      onClick={() => update("shop", s)}
                    />
                  ))}
                <button
                  type="button"
                  onClick={() => setShowAllShops((v) => !v)}
                  className="rounded-md border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50"
                >
                  {showAllShops ? "折りたたむ" : `その他 (${otherShops.length})`}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={excludeObsolete}
              onChange={(e) => setExcludeObsolete(e.target.checked)}
            />
            廃番を除外
          </label>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-2 text-sm text-slate-500">
          {loading
            ? "検索中..."
            : !hasAnyFilter
              ? "—"
              : total === 0
                ? "該当する行がありません"
                : `${total.toLocaleString()} 件ヒット${total > rows.length ? `（先頭 ${rows.length} 件を表示）` : ""}`}
        </div>
        {rows.length > 0 && (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="w-8 px-3 py-2"></th>
                  <th className="px-3 py-2">品目名称</th>
                  <th className="px-3 py-2">工程コード</th>
                  <th className="px-3 py-2">工程名称</th>
                  <th className="px-3 py-2">SHOP</th>
                  <th className="px-3 py-2 text-right">CT(秒)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isSelected = selected.includes(r.processCode);
                  return (
                    <tr
                      key={`${r.processCode}-${i}`}
                      onClick={() => toggleRow(r.processCode)}
                      className={`cursor-pointer border-t border-slate-200 ${isSelected ? "bg-blue-50" : "hover:bg-slate-50"}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(r.processCode)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-3 py-2">{r.itemName}</td>
                      <td className="px-3 py-2 font-mono text-xs font-medium text-blue-700">
                        {r.processCode}
                      </td>
                      <td className="px-3 py-2">{r.processName}</td>
                      <td className="px-3 py-2">{r.shop ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{r.cycleTime ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {proceedHref && (
        <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="text-sm">
            <span className="font-medium text-blue-900">{selected.length} 件選択中</span>
            <span className="ml-2 text-blue-700">{selected.join("、")}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected([])}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              クリア
            </button>
            <Link
              href={proceedHref}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              選択した工程でマニュアル作成
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ShopButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-md border border-blue-600 bg-blue-600 px-3 py-1 text-xs text-white"
          : "rounded-md border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-100"
      }
    >
      {label}
    </button>
  );
}

function FilterInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="部分一致"
        className="w-full rounded-md border border-slate-300 px-3 py-2"
      />
    </label>
  );
}
