'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'

export default function ProductNewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addProduct } = useProducts()

  const [name, setName] = useState('')
  // 工程表アプリからのリンク経由（/products/new?processCode=XXX）は自動セット
  const [processCode, setProcessCode] = useState(searchParams.get('processCode') ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const id = await addProduct(
        {
          name: name.trim(),
          processCodes: processCode.trim() ? [processCode.trim()] : [],
          processingNotes: '',
          specifications: [],
          appliedTemplateIds: [],
          templateValues: [],
        },
        []
      )
      router.replace(`/products/${id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 px-5 pt-6 pb-10">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-emerald-300 mb-4 active:opacity-70"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">戻る</span>
        </button>
        <h1 className="text-2xl font-bold text-white">製品を登録</h1>
        <p className="text-emerald-300 text-sm mt-1">登録後にテンプレートを適用できます</p>
      </div>

      <form onSubmit={handleSubmit} className="px-4 -mt-4 space-y-4 pb-8">
        <div className="bg-white rounded-2xl shadow-md p-4 space-y-4">
          <h2 className="font-bold text-slate-700 text-sm">基本情報</h2>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">
              製品名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：シャフトA"
              required
              autoFocus
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">
              工程コード
            </label>
            <input
              type="text"
              value={processCode}
              onChange={(e) => setProcessCode(e.target.value)}
              placeholder="例：C123456"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
            />
            <p className="text-[11px] text-slate-400 mt-1">工程表アプリからリンクで飛ぶためのキー。後から追加・変更もできます</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full bg-emerald-500 text-white font-bold rounded-2xl py-4 shadow-md active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
        >
          {saving ? '保存中...' : '登録する'}
        </button>
      </form>
    </div>
  )
}
