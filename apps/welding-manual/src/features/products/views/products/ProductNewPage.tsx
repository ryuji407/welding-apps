'use client'

import { useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, LayoutTemplate, ChevronRight } from 'lucide-react'
import { addProduct } from '../../hooks/useProducts'
import { useTemplates } from '../../hooks/useTemplates'
import TemplateApplySheet from '../../components/products/TemplateApplySheet'
import type { TemplateFieldValue } from '../../types/product'
import { generateId } from '../../utils/generateId'

export default function ProductNewPage({
  initialProcessCode,
  initialAliases = [],
  defaultName = '',
  masterInfo,
}: {
  initialProcessCode?: string
  initialAliases?: string[]
  defaultName?: string
  masterInfo?: ReactNode
} = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { templates } = useTemplates()

  // 工程表アプリのマスタ選択（MasterPicker）経由なら製品名・工程コードは自動セット済み
  const [name, setName] = useState(defaultName || '')
  const [processCode, setProcessCode] = useState(initialProcessCode ?? searchParams.get('processCode') ?? '')
  const aliases = initialAliases
  const [saving, setSaving] = useState(false)
  const [showApplySheet, setShowApplySheet] = useState(false)
  // 作り方テンプレート（未登録品はここから作り方を引き継いで作成する）
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const appliedTemplateInstances = selectedTemplateIds.map((templateId) => ({
        instanceId: generateId(),
        templateId,
      }))
      const templateValues: TemplateFieldValue[] = appliedTemplateInstances.flatMap(
        ({ instanceId, templateId }) => {
          const tmpl = templates.find((t) => t.id === templateId)
          if (!tmpl) return []
          return tmpl.fields.map((field) => ({
            templateId,
            instanceId,
            fieldId: field.id,
            label: field.label,
            type: field.type,
          }))
        }
      )
      const processCodes = Array.from(
        new Set([processCode.trim(), ...aliases].filter(Boolean))
      )
      const id = await addProduct(
        {
          name: name.trim(),
          processCodes,
          processingNotes: '',
          specifications: [],
          appliedTemplateIds: selectedTemplateIds,
          appliedTemplateInstances,
          templateValues,
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
        <p className="text-emerald-300 text-sm mt-1">作り方テンプレートを選んで登録できます</p>
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
              autoFocus={!defaultName}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
            />
            {defaultName && (
              <p className="text-[11px] text-slate-400 mt-1">子品番マスタから自動入力済み。必要なら書き換えできます</p>
            )}
          </div>
          {initialProcessCode ? (
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">
                工程コード{aliases.length > 0 ? `（色違いなど ${aliases.length + 1}件）` : ''}
              </label>
              {masterInfo}
            </div>
          ) : (
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
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowApplySheet(true)}
          className="w-full bg-white rounded-2xl shadow-md p-4 flex items-center justify-between active:bg-slate-50"
        >
          <div className="flex items-center gap-2">
            <LayoutTemplate size={16} className="text-emerald-600" />
            <span className="text-sm font-semibold text-slate-700">作り方テンプレートを引き継ぐ</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {selectedTemplateIds.length === 0
                ? '未選択'
                : selectedTemplateIds
                    .map((tid) => templates.find((t) => t.id === tid)?.name ?? '')
                    .filter(Boolean)
                    .join(', ')}
            </span>
            <ChevronRight size={15} className="text-slate-300" />
          </div>
        </button>

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full bg-emerald-500 text-white font-bold rounded-2xl py-4 shadow-md active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
        >
          {saving ? '保存中...' : '登録する'}
        </button>
      </form>

      {showApplySheet && (
        <TemplateApplySheet
          templates={templates}
          appliedIds={selectedTemplateIds}
          onApply={setSelectedTemplateIds}
          onClose={() => setShowApplySheet(false)}
        />
      )}
    </div>
  )
}
