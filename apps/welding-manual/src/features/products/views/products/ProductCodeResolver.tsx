'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Package, Plus, ArrowLeft } from 'lucide-react'
import { useProductByProcessCode } from '../../hooks/useProducts'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

/**
 * 工程コードから製品を解決するページ（工程表アプリのSHOP6リンクの着地点）。
 * - 該当製品あり → 製品詳細へリダイレクト
 * - なし → 未登録案内 + 工程コードをプレフィルした新規登録ボタン
 */
export default function ProductCodeResolver() {
  const params = useParams<{ processCode: string }>()
  const router = useRouter()

  const processCode = (() => {
    const raw = params.processCode ?? ''
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  })()

  const { product: matched, loading } = useProductByProcessCode(processCode)

  useEffect(() => {
    if (!loading && matched) {
      router.replace(`/products/${matched.id}`)
    }
  }, [loading, matched, router])

  if (loading || matched) return <LoadingSpinner />

  return (
    <div>
      <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 px-5 pt-6 pb-10 rounded-b-2xl">
        <button
          onClick={() => router.push('/products')}
          className="flex items-center gap-1.5 text-emerald-300 mb-4 active:opacity-70"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">製品一覧</span>
        </button>
        <h1 className="text-2xl font-bold text-white">工程コード: {processCode}</h1>
      </div>

      <div className="px-4 -mt-4 pb-8">
        <div className="bg-white rounded-2xl shadow-md p-8 flex flex-col items-center text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
            <Package size={28} className="text-slate-400" />
          </div>
          <p className="font-bold text-slate-700 mb-1">この工程コードの製品情報は未登録です</p>
          <p className="text-sm text-slate-400 mb-6">
            新規登録するか、既存の製品にこの工程コードを紐付けてください
          </p>
          <button
            onClick={() => router.push(`/products/new?processCode=${encodeURIComponent(processCode)}`)}
            className="flex items-center gap-2 bg-emerald-500 text-white font-bold rounded-2xl px-6 py-3.5 shadow-md active:scale-95 transition-transform"
          >
            <Plus size={18} />
            この工程コードで製品を登録
          </button>
        </div>
      </div>
    </div>
  )
}
