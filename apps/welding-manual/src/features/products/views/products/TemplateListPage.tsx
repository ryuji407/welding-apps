'use client'

import { useRouter } from 'next/navigation'
import { Plus, LayoutTemplate, ChevronRight } from 'lucide-react'
import { useTemplates } from '../../hooks/useTemplates'

const TYPE_LABELS = { text: 'テキスト', photo: '写真', video: '動画', select: 'プルダウン', checkbox: 'チェック' } as const


export default function TemplateListPage() {
  const router = useRouter()
  const { templates, loading } = useTemplates()

  return (
    <div>
      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 px-5 pt-6 pb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-emerald-300">
            <LayoutTemplate size={18} />
            <span className="text-sm font-semibold">テンプレート管理</span>
          </div>
          <button
            onClick={() => router.push('/products/templates/new')}
            className="flex items-center gap-1.5 bg-white/10 text-white rounded-2xl px-3 py-1.5 text-sm font-semibold active:opacity-70"
          >
            <Plus size={15} />
            新規作成
          </button>
        </div>
        <h1 className="text-2xl font-bold text-white">テンプレート</h1>
        <p className="text-emerald-300 text-sm mt-1">製品情報に適用するフォームを管理</p>
      </div>

      <div className="px-4 -mt-4 pb-8">
        {loading ? (
          <div className="bg-white rounded-2xl shadow-md p-6 text-center text-slate-400 text-sm">
            読み込み中...
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center">
            <LayoutTemplate size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="font-semibold text-slate-600 mb-1">テンプレートはまだありません</p>
            <p className="text-xs text-slate-400 mb-4">
              テンプレートを作成すると、製品情報に<br />適用して記録できます
            </p>
            <button
              onClick={() => router.push('/products/templates/new')}
              className="flex items-center gap-1.5 bg-emerald-500 text-white rounded-2xl px-4 py-2.5 text-sm font-bold mx-auto active:scale-95 transition-transform"
            >
              <Plus size={15} />
              テンプレートを作成
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md overflow-hidden">
            {templates.map((t, i) => (
              <button
                key={t.id}
                onClick={() => router.push(`/products/templates/${t.id}`)}
                className={`w-full flex items-center px-4 py-3.5 active:bg-slate-50 ${
                  i < templates.length - 1 ? 'border-b border-slate-100' : ''
                }`}
              >
                <div className="flex-1 text-left">
                  <p className="font-semibold text-slate-800 text-sm">{t.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t.fields.length === 0
                      ? 'フィールドなし'
                      : t.fields.map((f) => TYPE_LABELS[f.type]).join(' / ')}
                  </p>
                </div>
                <ChevronRight size={16} className="text-slate-300" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
