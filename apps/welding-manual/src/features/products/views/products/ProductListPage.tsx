'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Package, ChevronRight, Search, Upload, X, CheckCircle, AlertCircle, LayoutTemplate } from 'lucide-react'
import { useRef, useState, useEffect, useMemo } from 'react'
import { useProducts } from '../../hooks/useProducts'

interface ImportResult {
  imported: number
  linked: number
  skipped: string[]
  isFlexche: boolean
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export default function ProductListPage() {
  const { products, loading, addProduct, updateProduct } = useProducts()
  const router = useRouter()
  const searchParams = useSearchParams()
  const csvInputRef = useRef<HTMLInputElement>(null)

  const urlSearch = searchParams.get('search') ?? ''
  const [search, setSearch] = useState(urlSearch)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  // URLの?search=パラメータが変わったら検索欄を同期
  useEffect(() => {
    if (urlSearch) setSearch(urlSearch)
  }, [urlSearch])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.processCodes ?? []).some((c) => c.toLowerCase().includes(q))
    )
  }, [products, search])

  async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setImporting(true)
    try {
      // Shift-JIS / UTF-8 両対応（TextDecoder でフォールバック）
      const readAsText = (f: File, encoding: string): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsText(f, encoding)
        })

      let text = await readAsText(file, 'Shift-JIS')
      // 文字化けしている場合（置換文字が多い）は UTF-8 で再試行
      if ((text.match(/\uFFFD/g) ?? []).length > 5) {
        text = await readAsText(file, 'UTF-8')
      }

      const lines = text.split(/\r?\n/).filter((l) => l.trim())

      // フレクシェCSV判定（工程表アプリと同じ: ヘッダー3列目が "SHOP"）
      const headerValues = parseCSVLine(lines[0] ?? '')
      const isFlexche = headerValues[2]?.trim() === 'SHOP'

      // 1行目はヘッダーなのでスキップ
      const dataLines = lines.slice(1)

      if (isFlexche) {
        // ── フレクシェCSV: S6行から 工程コード(0列)×部品公式名(8列) を抽出して紐付け ──
        const nameToCodes = new Map<string, Set<string>>()
        for (const line of dataLines) {
          const values = parseCSVLine(line)
          if (values[2]?.trim() !== 'S6') continue
          const code = values[0]?.trim()
          const name = values[8]?.trim() || values[4]?.trim()
          if (!code || !name) continue
          if (!nameToCodes.has(name)) nameToCodes.set(name, new Set())
          nameToCodes.get(name)!.add(code)
        }

        const byName = new Map(products.map((p) => [p.name.trim().toLowerCase(), p]))
        let imported = 0
        let linked = 0

        for (const [name, codes] of nameToCodes) {
          const existing = byName.get(name.toLowerCase())
          if (existing) {
            // 既存製品: 未登録の工程コードだけ追加
            const merged = Array.from(new Set([...(existing.processCodes ?? []), ...codes]))
            if (merged.length !== (existing.processCodes ?? []).length) {
              await updateProduct(existing.id, { processCodes: merged })
              linked++
            }
          } else {
            // 未登録: 工程コード付きで新規作成
            await addProduct(
              { name, processCodes: Array.from(codes), processingNotes: '', specifications: [], appliedTemplateIds: [], templateValues: [] },
              []
            )
            imported++
          }
        }

        setImportResult({ imported, linked, skipped: [], isFlexche: true })
        return
      }

      // ── 従来CSV: F列（インデックス5）を製品名として取得し、重複を除去 ──
      const namesFromCSV = Array.from(
        new Set(
          dataLines
            .map((line) => parseCSVLine(line)[5]?.trim())
            .filter((name): name is string => !!name)
        )
      )

      // 既存の製品名セット（大文字小文字区別なし）
      const existingNames = new Set(products.map((p) => p.name.trim().toLowerCase()))

      const toImport: string[] = []
      const skipped: string[] = []

      for (const name of namesFromCSV) {
        if (existingNames.has(name.toLowerCase())) {
          skipped.push(name)
        } else {
          toImport.push(name)
        }
      }

      // 新規製品を一括登録
      for (const name of toImport) {
        await addProduct({ name, processingNotes: '', specifications: [], appliedTemplateIds: [], templateValues: [] }, [])
        existingNames.add(name.toLowerCase())
      }

      setImportResult({ imported: toImport.length, linked: 0, skipped, isFlexche: false })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 px-5 pt-6 pb-10">
        <div className="flex items-center gap-2 mb-1">
          <Package size={16} className="text-emerald-300" />
          <span className="text-emerald-300 text-xs font-semibold tracking-wider uppercase">
            製品管理
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">製品情報</h1>
        <p className="text-emerald-200/70 text-sm mt-0.5">加工注意点・不良履歴管理</p>
      </div>

      <div className="px-4 -mt-4 space-y-4 pb-6">
        {/* 検索 + 新規 + CSV */}
        <div className="flex gap-2">
          <div className="flex-1 bg-white rounded-2xl shadow-md flex items-center gap-2 px-3">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="製品名で検索"
              className="flex-1 py-3 text-sm outline-none bg-transparent placeholder:text-slate-400"
            />
          </div>
          <button
            onClick={() => csvInputRef.current?.click()}
            disabled={importing}
            className="bg-white text-slate-600 rounded-2xl shadow-md px-3 flex items-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50"
            title="CSVインポート"
          >
            <Upload size={17} />
            <span className="text-sm font-semibold">CSV</span>
          </button>
          <button
            onClick={() => router.push('/products/new')}
            className="bg-emerald-500 text-white rounded-2xl shadow-md px-4 flex items-center gap-1.5 active:scale-95 transition-transform"
          >
            <Plus size={18} />
            <span className="text-sm font-semibold">新規</span>
          </button>
        </div>

        <input
          ref={csvInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleCSVImport}
        />

        {/* インポート中 */}
        {importing && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-emerald-700">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin shrink-0" />
            CSVを取り込み中...
          </div>
        )}

        {/* インポート結果 */}
        {importResult && (
          <div className="bg-white rounded-2xl shadow-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 text-sm">インポート完了</span>
              <button onClick={() => setImportResult(null)} className="text-slate-400 active:opacity-70">
                <X size={18} />
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle size={16} className="shrink-0" />
              <span>{importResult.imported} 件を新規登録しました</span>
            </div>
            {importResult.isFlexche && (
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle size={16} className="shrink-0" />
                <span>{importResult.linked} 件の既存製品に工程コードを紐付けました（SHOP6行）</span>
              </div>
            )}
            {importResult.skipped.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>以下 {importResult.skipped.length} 件は既存のためスキップ</span>
                </div>
                <div className="bg-amber-50 rounded-xl px-3 py-2 max-h-32 overflow-y-auto">
                  {importResult.skipped.map((name, i) => (
                    <p key={i} className="text-xs text-amber-700 truncate">
                      {name}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 製品一覧 */}
        <section className="bg-white rounded-2xl shadow-md overflow-hidden">
          {loading ? (
            <p className="text-sm text-slate-400 p-4">読み込み中...</p>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Package size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {search ? '該当する製品が見つかりません' : '製品が登録されていません'}
              </p>
            </div>
          ) : (
            <ul>
              {filtered.map((p, i) => (
                <li key={p.id}>
                  <button
                    onClick={() => router.push(`/products/${p.id}`)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 text-left ${
                      i !== filtered.length - 1 ? 'border-b border-slate-50' : ''
                    }`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 overflow-hidden">
                      {p.photoUrls?.[0] ? (
                        <img
                          src={p.photoUrls[0]}
                          alt={p.name}
                          loading="lazy"
                          decoding="async"
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package size={20} className="text-emerald-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-800 truncate">{p.name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {(p.processCodes ?? []).slice(0, 3).map((code) => (
                          <span
                            key={code}
                            className="text-[10px] font-mono font-medium text-slate-500 bg-slate-100 rounded-full px-1.5 py-0.5"
                          >
                            {code}
                          </span>
                        ))}
                        {((p.appliedTemplateInstances ?? p.appliedTemplateIds ?? []).length) > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 bg-emerald-50 rounded-full px-1.5 py-0.5">
                            <LayoutTemplate size={9} />
                            {(p.appliedTemplateInstances ?? p.appliedTemplateIds ?? []).length}項目
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
