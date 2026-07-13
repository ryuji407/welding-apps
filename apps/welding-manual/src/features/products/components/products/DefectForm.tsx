'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import PhotoUploader from '../trouble/PhotoUploader'
import type { ProductDefectFormData } from '../../types/product'

interface Props {
  onSubmit: (data: ProductDefectFormData, photos: File[]) => Promise<void>
  onClose: () => void
}

function toLocalDatetimeString(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function DefectForm({ onSubmit, onClose }: Props) {
  const [occurredAt, setOccurredAt] = useState(toLocalDatetimeString(new Date()))
  const [reportedBy, setReportedBy] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) return
    setSaving(true)
    try {
      await onSubmit({ occurredAt, reportedBy, description }, photos)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-slate-100 flex items-center justify-between px-4 py-3.5 shadow-sm">
        <h2 className="font-bold text-slate-800">不良を記録</h2>
        <button onClick={onClose} className="text-slate-400 active:text-slate-600">
          <X size={22} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">発生日時</label>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">報告者</label>
            <input
              type="text"
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              placeholder="氏名を入力"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">
              不良内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="不良の内容・状況を記入"
              rows={4}
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-400 resize-none"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-slate-700 text-sm">写真</h3>
          <PhotoUploader files={photos} onChange={setPhotos} maxFiles={5} />
        </div>

        <button
          type="submit"
          disabled={saving || !description.trim()}
          className="w-full bg-red-500 text-white font-bold rounded-2xl py-4 shadow-md active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100"
        >
          {saving ? '保存中...' : '記録する'}
        </button>
      </form>
    </div>
  )
}
