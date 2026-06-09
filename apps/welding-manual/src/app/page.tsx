import Link from "next/link";
import { listManuals } from "@/lib/manual";
import DeleteButtonRow from "@/components/DeleteButtonRow";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const manuals = await listManuals(q);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">マニュアル一覧</h1>
        <Link
          href="/manual/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          ＋ 新規作成
        </Link>
      </div>

      <div className="flex gap-6 items-start">
        <div className="flex-1 min-w-0">
          {manuals.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              {q ? "該当するマニュアルがありません" : "まだマニュアルがありません"}
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-2">工程コード</th>
                    <th className="px-4 py-2">製品名</th>
                    <th className="px-4 py-2">更新日時</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {manuals.map((m) => (
                    <tr key={m.id} className="relative border-t border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium">
                        <Link
                          href={`/manual/${encodeURIComponent(m.processCode)}`}
                          className="after:absolute after:inset-0"
                        >
                          {m.processCode}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{m.productName ?? "—"}</td>
                      <td className="px-4 py-2 text-slate-500">
                        {m.updatedAt.toLocaleString("ja-JP")}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <DeleteButtonRow processCode={m.processCode} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="w-56 shrink-0">
          <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">絞り込み</p>
            <form method="get" className="space-y-2">
              <input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="工程コード or 製品名"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100"
              >
                検索
              </button>
              {q && (
                <a
                  href="/"
                  className="block text-center text-xs text-slate-500 hover:underline"
                >
                  クリア
                </a>
              )}
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
