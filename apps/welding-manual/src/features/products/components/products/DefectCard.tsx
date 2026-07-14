'use client'

import { useState } from 'react'
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { ProductDefect } from '../../types/product'
import { formatDateTime } from '../../utils/dateUtils'

interface Props {
  defect: ProductDefect
}

export default function DefectCard({ defect }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border-b border-slate-50 last:border-b-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3.5 active:bg-slate-50 text-left"
      >
        <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
          <AlertCircle size={16} className="text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500">{formatDateTime(new Date(defect.occurredAt))}</p>
          <p className="font-semibold text-sm text-slate-800 mt-0.5 line-clamp-2">
            {defect.description}
          </p>
          {defect.reportedBy && (
            <p className="text-xs text-slate-400 mt-0.5">報告者：{defect.reportedBy}</p>
          )}
        </div>
        <div className="text-slate-300 shrink-0 mt-1">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && defect.photoUrls.length > 0 && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-2">
            {defect.photoUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt={`不良写真${i + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="w-full aspect-square object-cover rounded-xl"
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
