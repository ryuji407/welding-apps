'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Type, Camera, ChevronDown, CheckSquare, Trash2, Check, Video } from 'lucide-react'
import { useTemplates } from '../../hooks/useTemplates'
import TemplateFieldEditor from '../../components/products/TemplateFieldEditor'
import type { TemplateField, TemplateFieldType } from '../../types/template'
import { generateId } from '../../utils/generateId'

function newField(type: TemplateFieldType): TemplateField {
  return {
    id: generateId(),
    type,
    label: '',
    ...(type === 'select' ? { options: [] } : {}),
  }
}

export default function TemplateEditPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const router = useRouter()
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplates()

  const isNew = templateId === undefined
  const existing = isNew ? null : templates.find((t) => t.id === templateId)

  const [name, setName] = useState('')
  const [fields, setFields] = useState<TemplateField[]>([])
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(isNew)

  // 既存データが読み込まれたら初期化（1回だけ）
  useEffect(() => {
    if (!isNew && existing && !ready) {
      setName(existing.name)
      setFields(existing.fields)
      setReady(true)
    }
  }, [existing, isNew, ready])

  function addField(type: TemplateFieldType) {
    setFields((prev) => [...prev, newField(type)])
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const TYPE_DEFAULTS = { text: 'テキスト', photo: '写真', video: '動画', select: 'プルダウン', checkbox: 'チェック' }
      const data = {
        name: name.trim(),
        fields: fields.map((f) => ({
          ...f,
          label: f.label.trim() || TYPE_DEFAULTS[f.type],
        })),
      }
      if (isNew) {
        await addTemplate(data)
      } else {
        await updateTemplate(templateId!, data)
      }
      router.push('/products/templates')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('このテンプレートを削除しますか？\n適用中の製品データには影響しません。')) return
    await deleteTemplate(templateId!)
    router.push('/products/templates')
  }

  if (!isNew && !ready) {
    return <div className="p-8 text-center text-slate-400 text-sm">読み込み中...</div>
  }

  return (
    <div className="pb-32">
      {/* ヘッダー */}
      <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 px-5 pt-6 pb-10">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => router.push('/products/templates')}
            className="flex items-center gap-1.5 text-emerald-300 active:opacity-70"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">一覧</span>
          </button>
          <div className="flex items-center gap-3">
            {!isNew && (
              <button onClick={handleDelete} className="text-red-300 active:opacity-70">
                <Trash2 size={18} />
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="flex items-center gap-1.5 text-emerald-300 active:opacity-70 disabled:opacity-40"
            >
              <Check size={20} />
              <span className="text-sm font-semibold">保存</span>
            </button>
          </div>
        </div>
        <h1 className="text-xl font-bold text-white">
          {isNew ? 'テンプレートを作成' : 'テンプレートを編集'}
        </h1>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* テンプレート名 */}
        <div className="bg-white rounded-2xl shadow-md p-4">
          <label className="text-xs font-semibold text-slate-500 mb-1.5 block">テンプレート名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：旋盤加工標準、治具情報"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
          />
        </div>

        {/* フィールド一覧 */}
        {fields.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md p-4 space-y-2">
            <h2 className="font-bold text-slate-700 text-sm mb-3">フィールド</h2>
            {fields.map((f, i) => (
              <TemplateFieldEditor
                key={f.id}
                field={f}
                onChange={(updated) => setFields((prev) => prev.map((x, idx) => (idx === i ? updated : x)))}
                onDelete={() => setFields((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>
        )}

        {/* フィールド追加ボタン */}
        <div className="bg-white rounded-2xl shadow-md p-4">
          <p className="text-xs font-semibold text-slate-500 mb-3">フィールドを追加</p>
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => addField('text')}
              className="flex flex-col items-center gap-1.5 border border-slate-200 rounded-2xl py-3 active:bg-slate-50"
            >
              <Type size={20} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-600">テキスト</span>
            </button>
            <button
              type="button"
              onClick={() => addField('photo')}
              className="flex flex-col items-center gap-1.5 border border-slate-200 rounded-2xl py-3 active:bg-slate-50"
            >
              <Camera size={20} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-600">写真</span>
            </button>
            <button
              type="button"
              onClick={() => addField('select')}
              className="flex flex-col items-center gap-1.5 border border-slate-200 rounded-2xl py-3 active:bg-slate-50"
            >
              <ChevronDown size={20} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-600">プルダウン</span>
            </button>
            <button
              type="button"
              onClick={() => addField('checkbox')}
              className="flex flex-col items-center gap-1.5 border border-slate-200 rounded-2xl py-3 active:bg-slate-50"
            >
              <CheckSquare size={20} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-600">チェック</span>
            </button>
            <button
              type="button"
              onClick={() => addField('video')}
              className="flex flex-col items-center gap-1.5 border border-slate-200 rounded-2xl py-3 active:bg-slate-50"
            >
              <Video size={20} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-600">動画</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
