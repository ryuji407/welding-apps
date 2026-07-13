'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, FileWarning, ChevronRight } from 'lucide-react'
import { useProductNotes } from '../../hooks/useProductNotes'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import { inputClass, labelClass, btnPrimary, btnSecondary } from '../../components/machine/MachineForm'

export default function ProductNoteListPage() {
  const { notes, loading, addProductNote } = useProductNotes()
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    if (!newName.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await addProductNote(newName.trim())
      router.push(`/product-notes/${encodeURIComponent(newName.trim())}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
      setSubmitting(false)
    }
  }

  const warningLevelColor = (count: { danger: number; caution: number; info: number }) => {
    if (count.danger > 0) return 'text-red-500 bg-red-50'
    if (count.caution > 0) return 'text-amber-500 bg-amber-50'
    if (count.info > 0) return 'text-blue-500 bg-blue-50'
    return 'text-slate-400 bg-slate-50'
  }

  return (
    <div>
      <PageHeader
        title="製品注意点"
        action={
          <button
            onClick={() => { setShowForm(true); setNewName(''); setError(null) }}
            className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white px-3 py-2 rounded-xl text-sm font-semibold active:bg-white/30 transition-colors"
          >
            <Plus size={16} />
            追加
          </button>
        }
      />

      {loading ? (
        <LoadingSpinner />
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
          <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center">
            <FileWarning size={36} strokeWidth={1.2} />
          </div>
          <p className="text-sm font-medium">製品注意点が登録されていません</p>
          <button
            onClick={() => { setShowForm(true); setNewName(''); setError(null) }}
            className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-2xl font-semibold shadow-md"
          >
            最初の注意点を登録
          </button>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {notes.map((note) => {
            const counts = { danger: 0, caution: 0, info: 0 }
            note.warnings.forEach((w) => counts[w.level]++)
            const colorClass = warningLevelColor(counts)
            const totalWarnings = counts.danger + counts.caution + counts.info

            return (
              <button
                key={note.id}
                onClick={() => router.push(`/product-notes/${encodeURIComponent(note.componentOfficialName)}`)}
                className="w-full bg-white rounded-2xl p-4 shadow-md active:scale-[0.98] transition-transform text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${colorClass}`}>
                    <FileWarning size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-base truncate">{note.componentOfficialName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {totalWarnings > 0 ? `注意事項 ${totalWarnings}件` : '注意事項なし'}
                      {note.instructionSteps && note.instructionSteps.length > 0
                        ? ` · 作業手順 ${note.instructionSteps.length}ステップ`
                        : ''}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 shrink-0" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {showForm && (
        <Modal
          title="製品注意点を追加"
          onClose={() => setShowForm(false)}
          footer={
            <div className="space-y-2">
              {error && <p className="text-red-500 text-xs text-center">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className={btnSecondary}>
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={submitting || !newName.trim()}
                  className={btnPrimary}
                >
                  {submitting ? '作成中...' : '作成して編集'}
                </button>
              </div>
            </div>
          }
        >
          <div className="py-2 space-y-4">
            <div>
              <label className={labelClass}>子品番の正式名称</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={inputClass}
                placeholder="例: t1.6xφ22.2x5500"
                autoFocus
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
