'use client'

import { X } from 'lucide-react'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function Modal({ title, onClose, children, footer }: ModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* sheet */}
      <div className="relative w-full bg-white rounded-t-3xl flex flex-col shadow-2xl overflow-hidden" style={{ maxHeight: '92vh' }}>
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 active:bg-slate-200 transition-colors"
          >
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* scrollable content */}
        <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-2">
          {children}
        </div>

        {/* fixed footer */}
        {footer && (
          <div className="shrink-0 px-5 py-4 border-t border-slate-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
