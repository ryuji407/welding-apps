"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { renderEditedImage, type CropRect } from "@/lib/imageEditUtils";

export default function ImageEditModal({
  mediaId,
  imageUrl,
  onClose,
  onSaved,
}: {
  mediaId: string;
  imageUrl: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [dragging, setDragging] = useState<{ startX: number; startY: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const drawCanvas = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!img || !canvas || !container || !img.complete || img.naturalWidth === 0) return;

    const nat = { w: img.naturalWidth, h: img.naturalHeight };
    const isRotated = rotation === 90 || rotation === 270;
    const rotatedW = isRotated ? nat.h : nat.w;
    const rotatedH = isRotated ? nat.w : nat.h;

    const maxW = container.clientWidth || 600;
    const maxH = Math.min(window.innerHeight * 0.55, 500);
    const scale = Math.min(maxW / rotatedW, maxH / rotatedH, 1);

    canvas.width = Math.round(rotatedW * scale);
    canvas.height = Math.round(rotatedH * scale);

    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, (-nat.w * scale) / 2, (-nat.h * scale) / 2, nat.w * scale, nat.h * scale);
    ctx.restore();
  }, [rotation]);

  useEffect(() => {
    if (loaded) {
      drawCanvas();
      setCropRect(null);
    }
  }, [rotation, loaded, drawCanvas]);

  function rotate(dir: 1 | -1) {
    setRotation((r) => {
      const vals: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];
      const idx = vals.indexOf(r);
      return vals[(idx + dir + 4) % 4];
    });
  }

  function getCanvasPos(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = getCanvasPos(e);
    setDragging({ startX: x, startY: y });
    setCropRect(null);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragging) return;
    const { x, y } = getCanvasPos(e);
    const canvas = canvasRef.current!;
    const rx = Math.max(0, Math.min(dragging.startX, x));
    const ry = Math.max(0, Math.min(dragging.startY, y));
    const rw = Math.min(Math.abs(x - dragging.startX), canvas.width - rx);
    const rh = Math.min(Math.abs(y - dragging.startY), canvas.height - ry);
    setCropRect({ x: rx, y: ry, w: rw, h: rh });
  }

  function onPointerUp() {
    setDragging(null);
    setCropRect((r) => (r && r.w > 5 && r.h > 5 ? r : null));
  }

  async function onSave() {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await renderEditedImage(img, rotation, cropRect, canvas);
      const fd = new FormData();
      fd.append("file", blob, "edit.jpg");
      const res = await fetch(`/api/media/${mediaId}/edit-image`, {
        method: "PATCH",
        body: fd,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "保存失敗");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">画像を編集</h2>
          <button
            onClick={onClose}
            className="text-xl leading-none text-slate-500 hover:text-slate-800"
          >
            ✕
          </button>
        </div>

        {/* 隠し img（Canvas の描画ソース） */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imageUrl}
          alt=""
          className="hidden"
          onLoad={() => setLoaded(true)}
        />

        {/* Canvas + クロップオーバーレイ */}
        <div
          ref={containerRef}
          className="flex min-h-32 justify-center overflow-hidden rounded bg-slate-100"
        >
          {!loaded && (
            <span className="self-center text-sm text-slate-400">読み込み中...</span>
          )}
          <div className="relative inline-block" style={{ display: loaded ? undefined : "none" }}>
            <canvas
              ref={canvasRef}
              className="cursor-crosshair"
              style={{ touchAction: "none" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
            {cropRect && (
              <div
                className="pointer-events-none absolute border-2 border-blue-400 bg-blue-200/20"
                style={{
                  left: cropRect.x,
                  top: cropRect.y,
                  width: cropRect.w,
                  height: cropRect.h,
                }}
              />
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-500">
          ドラッグしてトリミング範囲を選択
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => rotate(-1)}
            className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            ↺ 左に回転
          </button>
          <button
            onClick={() => rotate(1)}
            className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            ↻ 右に回転
          </button>
          <button
            onClick={() => setCropRect(null)}
            className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            選択リセット
          </button>
        </div>

        {error && <p className="text-center text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded border px-4 py-2 text-sm hover:bg-slate-100"
          >
            キャンセル
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
