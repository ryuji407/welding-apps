'use client'

import { Type, Camera, ChevronDown, CheckSquare, Trash2, Plus, X, Maximize, Columns2, Video } from 'lucide-react'
import type { TemplateField } from '../../types/template'

const TYPE_LABELS = { text: 'テキスト', photo: '写真', video: '動画', select: 'プルダウン', checkbox: 'チェック' } as const
const TYPE_ICONS = { text: Type, photo: Camera, video: Video, select: ChevronDown, checkbox: CheckSquare }

interface Props {
  field: TemplateField
  onChange: (field: TemplateField) => void
  onDelete: () => void
}

export default function TemplateFieldEditor({ field, onChange, onDelete }: Props) {
  const Icon = TYPE_ICONS[field.type]

  function addOption() {
    onChange({ ...field, options: [...(field.options ?? []), ''] })
  }

  function updateOption(i: number, val: string) {
    const options = (field.options ?? []).map((o, idx) => (idx === i ? val : o))
    onChange({ ...field, options })
  }

  function removeOption(i: number) {
    onChange({ ...field, options: (field.options ?? []).filter((_, idx) => idx !== i) })
  }

  return (
    <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        {/* 種別バッジ */}
        <span className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs font-semibold text-slate-600 shrink-0">
          <Icon size={11} />
          {TYPE_LABELS[field.type]}
        </span>
        {/* ラベル入力 */}
        <input
          type="text"
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          placeholder="項目名"
          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-emerald-400"
        />
        {/* 幅の切り替え */}
        <div className="flex bg-white rounded-xl border border-slate-200 p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => onChange({ ...field, width: 'full' })}
            className={`p-1 rounded-lg transition-colors ${
              (field.width ?? 'full') === 'full' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'
            }`}
            title="1列"
          >
            <Maximize size={14} />
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...field, width: 'half' })}
            className={`p-1 rounded-lg transition-colors ${
              field.width === 'half' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'
            }`}
            title="2列"
          >
            <Columns2 size={14} />
          </button>
        </div>
        {/* 削除 */}
        <button type="button" onClick={onDelete} className="text-slate-400 active:text-red-500 shrink-0">
          <Trash2 size={16} />
        </button>
      </div>

      {/* 選択肢リスト（selectのみ） */}
      {field.type === 'select' && (
        <div className="pl-2 space-y-1.5">
          {(field.options ?? []).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`選択肢 ${i + 1}`}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-emerald-400"
              />
              <button type="button" onClick={() => removeOption(i)} className="text-slate-400 active:text-red-500 shrink-0">
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-1 text-xs text-emerald-600 font-semibold active:opacity-70"
          >
            <Plus size={12} />
            選択肢を追加
          </button>
        </div>
      )}
    </div>
  )
}
