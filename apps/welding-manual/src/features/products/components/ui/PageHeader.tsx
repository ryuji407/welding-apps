'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  back?: boolean
  action?: React.ReactNode
  subtitle?: string
}

export default function PageHeader({ title, back = false, action, subtitle }: PageHeaderProps) {
  const router = useRouter()
  return (
    <header className="bg-gradient-to-br from-slate-800 to-slate-900 px-4 pt-5 pb-6 flex items-center gap-3 rounded-b-2xl">
      {back && (
        <button
          onClick={() => router.back()}
          className="p-2 -ml-1 rounded-2xl active:bg-white/20 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ChevronLeft size={22} className="text-white" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-slate-400 text-xs mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </header>
  )
}
