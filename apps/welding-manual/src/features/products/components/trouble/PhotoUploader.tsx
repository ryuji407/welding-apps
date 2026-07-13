'use client'

import { useRef, useState } from 'react'
import { Camera, X, ImageIcon } from 'lucide-react'

interface Props {
  files: File[]
  onChange: (files: File[]) => void
  maxFiles?: number
}

export default function PhotoUploader({ files, onChange, maxFiles = 5 }: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)
  const [previews, setPreviews] = useState<string[]>([])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length === 0) return

    const remaining = maxFiles - files.length
    const toAdd = selected.slice(0, remaining)

    const newFiles = [...files, ...toAdd]
    onChange(newFiles)

    toAdd.forEach((f) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setPreviews((prev) => [...prev, ev.target?.result as string])
      }
      reader.readAsDataURL(f)
    })

    // reset input so same file can be re-selected
    e.target.value = ''
  }

  function removeFile(index: number) {
    onChange(files.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {/* プレビュー */}
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((src, i) => (
            <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100">
              <img src={src} alt={`写真${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* アップロードボタン */}
      {files.length < maxFiles && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center gap-3 w-full border-2 border-dashed border-gray-300 rounded-xl py-4 px-4 text-gray-500 active:border-blue-400 active:text-blue-500 transition-colors"
          >
            <Camera size={22} />
            <div className="text-left">
              <p className="text-sm font-medium">カメラで撮影</p>
              <p className="text-xs text-gray-400">
                ({files.length}/{maxFiles})
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => libraryInputRef.current?.click()}
            className="flex items-center gap-3 w-full border-2 border-dashed border-gray-300 rounded-xl py-4 px-4 text-gray-500 active:border-blue-400 active:text-blue-500 transition-colors"
          >
            <ImageIcon size={22} />
            <div className="text-left">
              <p className="text-sm font-medium">ライブラリから選択</p>
              <p className="text-xs text-gray-400">
                保存済みの写真を選択 ({files.length}/{maxFiles})
              </p>
            </div>
          </button>
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
