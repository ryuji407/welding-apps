'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Plus, Pencil, X, BookOpen, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import { useProductNotes } from '../../hooks/useProductNotes'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import PhotoUploader from '../../components/trouble/PhotoUploader'
import { useImageUpload } from '../../hooks/useImageUpload'
import { inputClass, labelClass, btnPrimary, btnSecondary } from '../../components/machine/MachineForm'
import type { ProductWarning } from '../../types/product'
import type { InstructionStep } from '../../types/maintenance'

type EditStep = { text: string; existingPhotoUrl?: string; newPhoto: File[] }

const WARNING_CONFIG = {
  danger: { label: '危険', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700', icon: AlertCircle },
  caution: { label: '注意', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  info: { label: '情報', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700', icon: Info },
}

export default function ProductNoteDetailPage() {
  const { encodedName } = useParams<{ encodedName: string }>()
  // Next.js の params はURLエンコードされたまま返るため安全にデコードする
  // （デコード済みの値が来た場合も、% を含まない日本語名なら decodeURIComponent は無害）
  const componentOfficialName = (() => {
    const raw = encodedName ?? ''
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  })()
  const { notes, loading, updateProductNote } = useProductNotes()
  const { uploadImages, uploading } = useImageUpload()

  const note = notes.find((n) => n.componentOfficialName === componentOfficialName)

  // 警告追加モーダル
  const [showWarningForm, setShowWarningForm] = useState(false)
  const [warningLevel, setWarningLevel] = useState<'info' | 'caution' | 'danger'>('caution')
  const [warningText, setWarningText] = useState('')
  const [warningSubmitting, setWarningSubmitting] = useState(false)

  // 作業手順編集モーダル
  const [showInstructionEdit, setShowInstructionEdit] = useState(false)
  const [editSteps, setEditSteps] = useState<EditStep[]>([])
  const [instructionSaving, setInstructionSaving] = useState(false)
  const [instructionError, setInstructionError] = useState<string | null>(null)

  // 備考編集モーダル
  const [showNotesEdit, setShowNotesEdit] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)

  if (loading) return <LoadingSpinner />
  if (!note) return (
    <div>
      <PageHeader title={componentOfficialName} back />
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <p className="text-sm">「{componentOfficialName}」の注意点データが見つかりません</p>
      </div>
    </div>
  )

  const warnings = note.warnings ?? []
  const steps = note.instructionSteps ?? []

  async function addWarning() {
    if (!warningText.trim()) return
    setWarningSubmitting(true)
    const newWarnings: ProductWarning[] = [...warnings, { level: warningLevel, text: warningText.trim() }]
    await updateProductNote(note!.id, { warnings: newWarnings })
    setWarningText('')
    setWarningSubmitting(false)
    setShowWarningForm(false)
  }

  async function removeWarning(index: number) {
    const newWarnings = warnings.filter((_, i) => i !== index)
    await updateProductNote(note!.id, { warnings: newWarnings })
  }

  function openInstructionEdit() {
    const existing = steps.map((s) => ({
      text: s.text,
      existingPhotoUrl: s.photoUrl,
      newPhoto: [] as File[],
    }))
    setEditSteps(existing.length > 0 ? existing : [{ text: '', newPhoto: [] }])
    setInstructionError(null)
    setShowInstructionEdit(true)
  }

  async function saveInstructions() {
    setInstructionSaving(true)
    setInstructionError(null)
    try {
      const saved: InstructionStep[] = await Promise.all(
        editSteps.map(async (step) => {
          let photoUrl = step.existingPhotoUrl
          if (step.newPhoto.length > 0) {
            const [url] = await uploadImages(step.newPhoto, `product-notes/${note!.id}`)
            photoUrl = url
          }
          return { text: step.text, ...(photoUrl ? { photoUrl } : {}) }
        })
      )
      await updateProductNote(note!.id, { instructionSteps: saved.filter((s) => s.text.trim()) })
      setShowInstructionEdit(false)
    } catch (e) {
      setInstructionError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setInstructionSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title={componentOfficialName} back />

      {/* 注意事項セクション */}
      <div className="mx-4 mt-4 bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-slate-500" />
            <h2 className="font-bold text-slate-700 text-sm">注意事項</h2>
          </div>
          <button
            onClick={() => { setShowWarningForm(true); setWarningText(''); setWarningLevel('caution') }}
            className="flex items-center gap-1 text-blue-500 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Plus size={12} /> 追加
          </button>
        </div>

        <div className="px-4 py-3 space-y-2">
          {warnings.length === 0 ? (
            <p className="text-sm text-slate-400 py-3 text-center">注意事項が登録されていません</p>
          ) : (
            warnings.map((w, i) => {
              const cfg = WARNING_CONFIG[w.level]
              const WIcon = cfg.icon
              return (
                <div key={i} className={`flex items-start gap-3 rounded-xl p-3 ${cfg.bg} border ${cfg.border}`}>
                  <WIcon size={16} className={`${cfg.text} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <span className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded-full mb-1 ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    <p className={`text-sm ${cfg.text} whitespace-pre-wrap`}>{w.text}</p>
                  </div>
                  <button
                    onClick={() => removeWarning(i)}
                    className="text-slate-300 hover:text-red-400 transition-colors shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 作業手順セクション */}
      <div className="mx-4 mt-4 bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-slate-500" />
            <h2 className="font-bold text-slate-700 text-sm">作業手順</h2>
          </div>
          <button
            onClick={openInstructionEdit}
            className="flex items-center gap-1 text-blue-500 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Pencil size={12} /> 編集
          </button>
        </div>

        <div className="px-4 py-3">
          {steps.length === 0 ? (
            <p className="text-sm text-slate-400 py-3 text-center">作業手順が登録されていません</p>
          ) : (
            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={i}>
                  <div className="flex items-start gap-3 mb-2">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-sm text-slate-700 flex-1 whitespace-pre-wrap leading-relaxed">{step.text}</p>
                  </div>
                  {step.photoUrl && (
                    <a href={step.photoUrl} target="_blank" rel="noopener noreferrer" className="block ml-9">
                      <img src={step.photoUrl} alt={`手順${i + 1}`} loading="lazy" decoding="async" className="w-full max-w-sm rounded-xl border border-slate-100 object-cover" />
                    </a>
                  )}
                  {i < steps.length - 1 && <div className="ml-9 mt-4 border-t border-slate-100" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 備考セクション */}
      <div className="mx-4 mt-4 mb-8 bg-white rounded-2xl shadow-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="font-bold text-slate-700 text-sm">備考</h2>
          <button
            onClick={() => { setEditNotes(note.notes ?? ''); setShowNotesEdit(true) }}
            className="flex items-center gap-1 text-blue-500 text-xs font-semibold px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
          >
            <Pencil size={12} /> 編集
          </button>
        </div>
        <div className="px-4 py-3">
          {note.notes ? (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{note.notes}</p>
          ) : (
            <p className="text-sm text-slate-400 py-3 text-center">備考なし</p>
          )}
        </div>
      </div>

      {/* 警告追加モーダル */}
      {showWarningForm && (
        <Modal
          title="注意事項を追加"
          onClose={() => setShowWarningForm(false)}
          footer={
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowWarningForm(false)} className={btnSecondary}>キャンセル</button>
              <button type="button" onClick={addWarning} disabled={warningSubmitting || !warningText.trim()} className={btnPrimary}>
                {warningSubmitting ? '保存中...' : '保存'}
              </button>
            </div>
          }
        >
          <div className="space-y-4 py-2">
            <div>
              <label className={labelClass}>レベル</label>
              <div className="flex gap-2">
                {(['danger', 'caution', 'info'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setWarningLevel(level)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      warningLevel === level
                        ? `${WARNING_CONFIG[level].badge} ${WARNING_CONFIG[level].border}`
                        : 'border-slate-200 text-slate-400'
                    }`}
                  >
                    {WARNING_CONFIG[level].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>内容</label>
              <textarea
                value={warningText}
                onChange={(e) => setWarningText(e.target.value)}
                rows={4}
                className={`${inputClass} resize-none`}
                placeholder="注意事項の内容を入力..."
                autoFocus
              />
            </div>
          </div>
        </Modal>
      )}

      {/* 作業手順編集モーダル */}
      {showInstructionEdit && (
        <Modal
          title="作業手順を編集"
          onClose={() => setShowInstructionEdit(false)}
          footer={
            <div className="space-y-2">
              {instructionError && <p className="text-red-500 text-xs text-center">{instructionError}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowInstructionEdit(false)} className={btnSecondary}>キャンセル</button>
                <button type="button" onClick={saveInstructions} disabled={instructionSaving || uploading} className={btnPrimary}>
                  {instructionSaving || uploading ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-3 py-2">
            {editSteps.map((step, i) => (
              <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">STEP {i + 1}</span>
                  <button type="button" onClick={() => setEditSteps((prev) => prev.filter((_, idx) => idx !== i))} className="text-slate-300 hover:text-red-400 transition-colors">
                    <X size={16} />
                  </button>
                </div>
                <textarea
                  value={step.text}
                  onChange={(e) => setEditSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, text: e.target.value } : s))}
                  rows={2}
                  className={`${inputClass} resize-none`}
                  placeholder="この手順の説明を入力..."
                />
                {step.existingPhotoUrl ? (
                  <div className="flex items-center gap-3">
                    <img src={step.existingPhotoUrl} alt="" className="w-20 h-20 object-cover rounded-xl border border-slate-100" />
                    <button type="button" onClick={() => setEditSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, existingPhotoUrl: undefined } : s))} className="text-xs text-red-400 hover:text-red-600 font-medium">写真を削除</button>
                  </div>
                ) : (
                  <PhotoUploader
                    files={step.newPhoto}
                    onChange={(files) => setEditSteps((prev) => prev.map((s, idx) => idx === i ? { ...s, newPhoto: files } : s))}
                    maxFiles={1}
                  />
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setEditSteps((prev) => [...prev, { text: '', newPhoto: [] }])}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-3 text-sm font-semibold text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
            >
              <Plus size={16} /> ステップを追加
            </button>
          </div>
        </Modal>
      )}

      {/* 備考編集モーダル */}
      {showNotesEdit && (
        <Modal
          title="備考を編集"
          onClose={() => setShowNotesEdit(false)}
          footer={
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowNotesEdit(false)} className={btnSecondary}>キャンセル</button>
              <button
                type="button"
                onClick={async () => {
                  setNotesSaving(true)
                  await updateProductNote(note.id, { notes: editNotes })
                  setNotesSaving(false)
                  setShowNotesEdit(false)
                }}
                disabled={notesSaving}
                className={btnPrimary}
              >
                {notesSaving ? '保存中...' : '保存'}
              </button>
            </div>
          }
        >
          <div className="py-2">
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={6}
              className={`${inputClass} resize-none`}
              placeholder="備考を入力..."
              autoFocus
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
