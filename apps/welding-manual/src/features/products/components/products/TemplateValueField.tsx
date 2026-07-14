'use client'

import { useRef } from 'react'
import { Camera, ImagePlus, ImageIcon, Pencil, CheckSquare, Square, Trash2, Video, VideoIcon } from 'lucide-react'
import type { TemplateFieldValue } from '../../types/product'

interface Props {
  value: TemplateFieldValue
  editing: boolean
  options?: string[]
  onChange?: (updated: TemplateFieldValue) => void
  onAnnotate?: () => void
  onPhotoSelect?: (file: File) => void
  onVideoSelect?: (file: File) => void
}

export default function TemplateValueField({
  value,
  editing,
  options,
  onChange,
  onAnnotate,
  onPhotoSelect,
  onVideoSelect,
}: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const libraryInputRef = useRef<HTMLInputElement>(null)
  const videoCameraInputRef = useRef<HTMLInputElement>(null)
  const videoLibraryInputRef = useRef<HTMLInputElement>(null)

  if (!editing) {
    // 閲覧モード
    return (
      <div>
        <span className="text-xs text-slate-500 block mb-0.5">{value.label}</span>
        {value.type === 'photo' ? (
          value.videoUrl ? (
            <video
              src={value.videoUrl}
              controls
              playsInline
              preload="metadata"
              className="max-w-full rounded-xl border border-slate-200"
              style={{ maxHeight: 240 }}
            />
          ) : value.photoUrl ? (
            <div className="relative w-fit">
              <a href={value.photoUrl} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={value.photoUrl}
                  alt={value.label}
                  loading="lazy"
                  decoding="async"
                  className="max-w-[240px] rounded-xl border border-slate-200 object-cover"
                />
              </a>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); onAnnotate?.() }}
                className="absolute bottom-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center active:scale-90"
              >
                <Pencil size={13} />
              </button>
            </div>
          ) : (
            <span className="text-sm text-slate-400">未入力</span>
          )
        ) : value.type === 'video' ? (
          value.videoUrl ? (
            <video
              src={value.videoUrl}
              controls
              playsInline
              preload="metadata"
              className="max-w-full rounded-xl border border-slate-200"
              style={{ maxHeight: 240 }}
            />
          ) : (
            <span className="text-sm text-slate-400">未入力</span>
          )
        ) : value.type === 'checkbox' ? (
          <span className={`flex items-center gap-1.5 text-sm font-semibold ${value.boolValue ? 'text-emerald-600' : 'text-slate-400'}`}>
            {value.boolValue
              ? <CheckSquare size={16} className="shrink-0" />
              : <Square size={16} className="shrink-0" />
            }
            {value.boolValue ? 'はい' : 'いいえ'}
          </span>
        ) : (
          <span className="text-sm font-semibold text-slate-800 whitespace-pre-wrap">
            {value.textValue || <span className="text-slate-400 font-normal">未入力</span>}
          </span>
        )}
      </div>
    )
  }

  // 編集モード
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-500 block">{value.label}</label>

      {value.type === 'text' && (
        <textarea
          value={value.textValue ?? ''}
          onChange={(e) => onChange?.({ ...value, textValue: e.target.value })}
          placeholder="値を入力"
          rows={3}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-400 resize-none min-h-[80px]"
        />
      )}

      {value.type === 'select' && (
        <select
          value={value.textValue ?? ''}
          onChange={(e) => onChange?.({ ...value, textValue: e.target.value })}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400 bg-white"
        >
          <option value="">選択してください</option>
          {(options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {value.type === 'checkbox' && (
        <button
          type="button"
          onClick={() => onChange?.({ ...value, boolValue: !value.boolValue })}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 text-sm font-semibold transition-colors active:scale-95 ${
            value.boolValue
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-white text-slate-500'
          }`}
        >
          {value.boolValue
            ? <CheckSquare size={18} className="shrink-0" />
            : <Square size={18} className="shrink-0" />
          }
          {value.boolValue ? 'はい' : 'いいえ'}
        </button>
      )}

      {value.type === 'video' && (
        <>
          <input
            ref={videoCameraInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onVideoSelect?.(file)
              e.target.value = ''
            }}
          />
          <input
            ref={videoLibraryInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onVideoSelect?.(file)
              e.target.value = ''
            }}
          />
          {value.videoUrl ? (
            <div className="space-y-1.5">
              <video
                src={value.videoUrl}
                controls
                playsInline
                className="max-w-full rounded-xl border border-slate-200"
                style={{ maxHeight: 200 }}
              />
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => videoCameraInputRef.current?.click()}
                  className="flex items-center gap-1 text-blue-500 text-xs border border-dashed border-blue-300 rounded-xl px-2.5 py-1.5 active:opacity-70"
                >
                  <Video size={12} />
                  録画
                </button>
                <button
                  type="button"
                  onClick={() => videoLibraryInputRef.current?.click()}
                  className="flex items-center gap-1 text-blue-500 text-xs border border-dashed border-blue-300 rounded-xl px-2.5 py-1.5 active:opacity-70"
                >
                  <VideoIcon size={12} />
                  ライブラリ
                </button>
                <button
                  type="button"
                  onClick={() => onChange?.({ ...value, videoUrl: undefined })}
                  className="flex items-center gap-1 text-red-400 text-xs border border-dashed border-red-300 rounded-xl px-2.5 py-1.5 active:opacity-70"
                >
                  <Trash2 size={12} />
                  削除
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => videoCameraInputRef.current?.click()}
                className="flex items-center gap-1.5 text-blue-500 text-xs border border-dashed border-blue-300 rounded-xl px-3 py-2 active:opacity-70"
              >
                <Video size={13} />
                カメラで録画
              </button>
              <button
                type="button"
                onClick={() => videoLibraryInputRef.current?.click()}
                className="flex items-center gap-1.5 text-blue-500 text-xs border border-dashed border-blue-300 rounded-xl px-3 py-2 active:opacity-70"
              >
                <VideoIcon size={13} />
                ライブラリから選択
              </button>
            </div>
          )}
        </>
      )}

      {value.type === 'photo' && (
        <>
          {/* 写真用 input */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onPhotoSelect?.(file)
              e.target.value = ''
            }}
          />
          <input
            ref={libraryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onPhotoSelect?.(file)
              e.target.value = ''
            }}
          />
          {/* 動画用 input */}
          <input
            ref={videoCameraInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onVideoSelect?.(file)
              e.target.value = ''
            }}
          />
          <input
            ref={videoLibraryInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onVideoSelect?.(file)
              e.target.value = ''
            }}
          />

          {/* 差し替え・削除ボタン（写真・動画 共通） */}
          {(() => {
            const replaceButtons = (
              <div className="flex gap-1.5 flex-wrap">
                <button type="button" onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-1 text-blue-500 text-xs border border-dashed border-blue-300 rounded-xl px-2.5 py-1.5 active:opacity-70">
                  <Camera size={12} />撮影
                </button>
                <button type="button" onClick={() => libraryInputRef.current?.click()}
                  className="flex items-center gap-1 text-blue-500 text-xs border border-dashed border-blue-300 rounded-xl px-2.5 py-1.5 active:opacity-70">
                  <ImageIcon size={12} />写真
                </button>
                <button type="button" onClick={() => videoCameraInputRef.current?.click()}
                  className="flex items-center gap-1 text-blue-500 text-xs border border-dashed border-blue-300 rounded-xl px-2.5 py-1.5 active:opacity-70">
                  <Video size={12} />録画
                </button>
                <button type="button" onClick={() => videoLibraryInputRef.current?.click()}
                  className="flex items-center gap-1 text-blue-500 text-xs border border-dashed border-blue-300 rounded-xl px-2.5 py-1.5 active:opacity-70">
                  <VideoIcon size={12} />動画
                </button>
                <button type="button"
                  onClick={() => onChange?.({ ...value, photoUrl: undefined, videoUrl: undefined })}
                  className="flex items-center gap-1 text-red-400 text-xs border border-dashed border-red-300 rounded-xl px-2.5 py-1.5 active:opacity-70">
                  <Trash2 size={12} />削除
                </button>
              </div>
            )

            if (value.photoUrl) {
              return (
                <div className="space-y-1.5 w-fit">
                  <img src={value.photoUrl} alt={value.label}
                    className="max-w-[160px] rounded-xl border border-slate-200 object-cover" />
                  {replaceButtons}
                </div>
              )
            }
            if (value.videoUrl) {
              return (
                <div className="space-y-1.5">
                  <video src={value.videoUrl} controls playsInline
                    className="max-w-full rounded-xl border border-slate-200" style={{ maxHeight: 200 }} />
                  {replaceButtons}
                </div>
              )
            }
            return (
              <div className="space-y-1.5">
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-blue-500 text-xs border border-dashed border-blue-300 rounded-xl px-3 py-2 active:opacity-70">
                    <Camera size={13} />カメラで撮影
                  </button>
                  <button type="button" onClick={() => libraryInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-blue-500 text-xs border border-dashed border-blue-300 rounded-xl px-3 py-2 active:opacity-70">
                    <ImagePlus size={13} />ライブラリ(写真)
                  </button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button type="button" onClick={() => videoCameraInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-blue-500 text-xs border border-dashed border-blue-300 rounded-xl px-3 py-2 active:opacity-70">
                    <Video size={13} />カメラで録画
                  </button>
                  <button type="button" onClick={() => videoLibraryInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-blue-500 text-xs border border-dashed border-blue-300 rounded-xl px-3 py-2 active:opacity-70">
                    <VideoIcon size={13} />ライブラリ(動画)
                  </button>
                </div>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
