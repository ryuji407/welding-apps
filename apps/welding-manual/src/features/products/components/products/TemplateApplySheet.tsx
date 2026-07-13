'use client'

import { useState } from 'react'
import { X, Plus, LayoutTemplate } from 'lucide-react'

import type { ProductTemplate } from '../../types/template'

interface Props {
  templates: ProductTemplate[]
  appliedIds: string[]
  onApply: (ids: string[]) => void
  onClose: () => void
}

export default function TemplateApplySheet({ templates, appliedIds, onApply, onClose }: Props) {
  // appliedIds はレガシー互換。内部では重複を許容する
  const [selectedIds, setSelectedIds] = useState<string[]>(appliedIds)

  function add(id: string) {
    setSelectedIds((prev) => [...prev, id])
  }

  function remove(index: number) {
    setSelectedIds((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" onClick={onClose}>
      {/* オーバーレイ（視覚のみ） */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      {/* シート本体 */}
      <div className="relative z-10 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* ドラッグハンドル */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex flex-col">
            <h2 className="font-bold text-slate-800">テンプレートを選択</h2>
            <p className="text-xs text-slate-400">同じテンプレートを複数追加できます</p>
          </div>
          <button onClick={onClose} className="text-slate-400 active:opacity-70">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* 選択済みリスト */}
          {selectedIds.length > 0 && (
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">選択中のテンプレート</p>
              <div className="flex flex-wrap gap-2">
                {selectedIds.map((id, i) => {
                  const tmpl = templates.find(t => t.id === id)
                  return (
                    <div key={`${id}-${i}`} className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-emerald-200 animate-in fade-in zoom-in-95 duration-200">
                      <span>{tmpl?.name ?? 'Unknown'}</span>
                      <button onClick={() => remove(i)} className="p-0.5 hover:bg-emerald-200 rounded-full transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* テンプレートリスト */}
          <div className="overflow-y-auto flex-1">
            {templates.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">テンプレートがありません</p>
            ) : (
              templates.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => add(t.id)}
                  className={`w-full flex items-center justify-between px-5 py-4 active:bg-slate-50 transition-colors ${
                    i < templates.length - 1 ? 'border-b border-slate-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                      <LayoutTemplate size={20} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-800 text-sm">{t.name}</p>
                      <p className="text-[10px] text-slate-400">{t.fields.length}フィールド</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 group-active:scale-90 transition-transform">
                    <Plus size={16} />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 適用ボタン */}
        <div className="p-4 pb-12 border-t border-slate-100 bg-white">
          <button
            onClick={() => { onApply(selectedIds); onClose() }}
            className="w-full bg-emerald-600 text-white font-bold rounded-2xl py-4 shadow-md active:scale-95 transition-all"
          >
            適用する ({selectedIds.length})
          </button>
        </div>
      </div>
    </div>
  )
}
