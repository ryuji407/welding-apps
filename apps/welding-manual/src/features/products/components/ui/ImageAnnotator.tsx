'use client'

import { useRef, useEffect, useState } from 'react'
import { X, RotateCcw, Pencil, Eraser } from 'lucide-react'

type Tool = 'pen' | 'eraser'

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#000000', '#ffffff']
const SIZES = [
  { value: 4, label: 'S' },
  { value: 12, label: 'M' },
  { value: 28, label: 'L' },
]

interface Props {
  imageUrl: string
  onSave: (blob: Blob) => Promise<void>
  onClose: () => void
}

export default function ImageAnnotator({ imageUrl, onSave, onClose }: Props) {
  const imageCanvasRef = useRef<HTMLCanvasElement>(null)  // 画像レイヤー（変更なし）
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)   // 描画レイヤー
  const isDrawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#ef4444')
  const [size, setSize] = useState(12)
  const [undoStack, setUndoStack] = useState<ImageData[]>([])
  const [saving, setSaving] = useState(false)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)

  // 画像を imageCanvas に描画
  useEffect(() => {
    const imgCanvas = imageCanvasRef.current
    const drawCanvas = drawCanvasRef.current
    if (!imgCanvas || !drawCanvas) return
    const ctx = imgCanvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgCanvas.width = img.naturalWidth
      imgCanvas.height = img.naturalHeight
      drawCanvas.width = img.naturalWidth
      drawCanvas.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.src = imageUrl
  }, [imageUrl])

  // ポインターイベント（passive:false でスクロール抑制）
  useEffect(() => {
    const canvas = drawCanvasRef.current
    if (!canvas || !imgSize) return

    function getPoint(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const scaleX = canvas!.width / rect.width
      const scaleY = canvas!.height / rect.height
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      }
    }

    function saveSnapshot() {
      const ctx = canvas!.getContext('2d')!
      const snap = ctx.getImageData(0, 0, canvas!.width, canvas!.height)
      setUndoStack((prev) => [...prev.slice(-19), snap])
    }

    function stroke(from: { x: number; y: number }, to: { x: number; y: number }) {
      const ctx = canvas!.getContext('2d')!
      ctx.save()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.lineWidth = size * 3
        ctx.strokeStyle = 'rgba(0,0,0,1)'
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.lineWidth = size
        ctx.strokeStyle = color
      }
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
      ctx.restore()
    }

    function onPointerDown(e: PointerEvent) {
      e.preventDefault()
      canvas!.setPointerCapture(e.pointerId)
      saveSnapshot()
      isDrawing.current = true
      const pt = getPoint(e)
      lastPoint.current = pt
      stroke(pt, pt)
    }

    function onPointerMove(e: PointerEvent) {
      if (!isDrawing.current || !lastPoint.current) return
      e.preventDefault()
      const pt = getPoint(e)
      stroke(lastPoint.current, pt)
      lastPoint.current = pt
    }

    function onPointerUp() {
      isDrawing.current = false
      lastPoint.current = null
    }

    canvas.addEventListener('pointerdown', onPointerDown, { passive: false })
    canvas.addEventListener('pointermove', onPointerMove, { passive: false })
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
    }
  }, [imgSize, tool, color, size])

  function undo() {
    const canvas = drawCanvasRef.current
    if (!canvas || undoStack.length === 0) return
    const ctx = canvas.getContext('2d')!
    const prev = undoStack[undoStack.length - 1]
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.putImageData(prev, 0, 0)
    setUndoStack((prev) => prev.slice(0, -1))
  }

  async function handleSave() {
    const imgCanvas = imageCanvasRef.current
    const drawCanvas = drawCanvasRef.current
    if (!imgCanvas || !drawCanvas) return
    setSaving(true)
    try {
      // 合成: 画像 + 描画を1枚に
      const merged = document.createElement('canvas')
      merged.width = imgCanvas.width
      merged.height = imgCanvas.height
      const ctx = merged.getContext('2d')!
      ctx.drawImage(imgCanvas, 0, 0)
      ctx.drawImage(drawCanvas, 0, 0)

      const blob = await new Promise<Blob>((resolve, reject) => {
        merged.toBlob((b) => (b ? resolve(b) : reject(new Error('blob error'))), 'image/jpeg', 0.92)
      })
      await onSave(blob)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* ツールバー */}
      <div className="bg-slate-900 px-3 pt-safe pt-3 pb-2 flex flex-wrap items-center gap-2 shrink-0">
        <button onClick={onClose} className="text-white/50 active:text-white mr-1">
          <X size={22} />
        </button>

        {/* ペン / 消しゴム */}
        <div className="flex bg-slate-800 rounded-xl p-0.5">
          <button
            onClick={() => setTool('pen')}
            className={`px-3 py-1.5 rounded-[10px] flex items-center gap-1.5 text-xs font-semibold transition-colors ${
              tool === 'pen' ? 'bg-white text-slate-900' : 'text-white/50'
            }`}
          >
            <Pencil size={13} /> ペン
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`px-3 py-1.5 rounded-[10px] flex items-center gap-1.5 text-xs font-semibold transition-colors ${
              tool === 'eraser' ? 'bg-white text-slate-900' : 'text-white/50'
            }`}
          >
            <Eraser size={13} /> 消しゴム
          </button>
        </div>

        {/* カラーパレット */}
        {tool === 'pen' && (
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform active:scale-110 ${
                  color === c ? 'border-white scale-125' : 'border-slate-600'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}

        {/* サイズ */}
        <div className="flex items-center gap-1 ml-auto">
          {SIZES.map(({ value }) => (

            <button
              key={value}
              onClick={() => setSize(value)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                size === value ? 'bg-white' : 'bg-slate-800'
              }`}
            >
              <span
                className={`rounded-full ${size === value ? 'bg-slate-900' : 'bg-white/40'}`}
                style={{ width: Math.min(value, 20) + 4, height: Math.min(value, 20) + 4 }}
              />
            </button>
          ))}
        </div>

        {/* 元に戻す */}
        <button
          onClick={undo}
          disabled={undoStack.length === 0}
          className="text-white/50 disabled:opacity-20 active:text-white"
        >
          <RotateCcw size={20} />
        </button>

        {/* 保存 */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-xl active:scale-95 disabled:opacity-50 transition-transform"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      {/* キャンバスエリア */}
      <div className="flex-1 overflow-auto bg-neutral-900 flex items-center justify-center p-2">
        {!imgSize && <p className="text-white/40 text-sm">読み込み中...</p>}
        <div
          className="relative"
          style={
            imgSize
              ? { width: '100%', maxWidth: imgSize.w, aspectRatio: `${imgSize.w}/${imgSize.h}` }
              : { display: 'none' }
          }
        >
          <canvas
            ref={imageCanvasRef}
            className="absolute inset-0 w-full h-full"
          />
          <canvas
            ref={drawCanvasRef}
            className="absolute inset-0 w-full h-full touch-none"
            style={{ cursor: 'crosshair' }}
          />
        </div>
      </div>
    </div>
  )
}
