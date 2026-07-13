'use client'

export default function LoadingSpinner({ message = '読み込み中...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
      <div className="w-8 h-8 border-3 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      <span className="text-sm">{message}</span>
    </div>
  )
}
