"use client";

import { useRef, useState } from "react";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VideoEditModal({
  mediaId,
  videoUrl,
  onClose,
  onSaved,
}: {
  mediaId: string;
  videoUrl: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setCurrentAsStart() {
    const t = videoRef.current?.currentTime ?? 0;
    setStartTime(Math.round(t * 10) / 10);
  }

  function setCurrentAsEnd() {
    const t = videoRef.current?.currentTime ?? 0;
    setEndTime(Math.round(t * 10) / 10);
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/media/${mediaId}/edit-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotation, startTime, endTime }),
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

  const rotations: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">動画を編集</h2>
          <button
            onClick={onClose}
            className="text-xl leading-none text-slate-500 hover:text-slate-800"
          >
            ✕
          </button>
        </div>

        <video
          ref={videoRef}
          src={videoUrl}
          controls
          playsInline
          className="aspect-video w-full rounded bg-black"
          onLoadedMetadata={() => {
            const v = videoRef.current;
            if (v) setDuration(v.duration);
          }}
        />

        {/* トリム */}
        <div className="rounded-md border border-slate-200 p-3">
          <p className="mb-2 text-sm font-medium text-slate-700">トリミング</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-600">開始時間</span>
              <input
                type="number"
                min={0}
                max={endTime ?? duration}
                step={0.1}
                value={startTime}
                onChange={(e) => setStartTime(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <span className="text-xs text-slate-500">{formatTime(startTime)}</span>
              <button
                type="button"
                onClick={setCurrentAsStart}
                className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
              >
                現在位置
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-600">終了時間</span>
              <input
                type="number"
                min={startTime}
                max={duration}
                step={0.1}
                value={endTime ?? ""}
                placeholder={duration > 0 ? formatTime(duration) : "末尾"}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setEndTime(isNaN(v) ? null : Math.min(duration, v));
                }}
                className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <span className="text-xs text-slate-500">
                {endTime !== null ? formatTime(endTime) : "末尾まで"}
              </span>
              <button
                type="button"
                onClick={setCurrentAsEnd}
                className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
              >
                現在位置
              </button>
            </div>
          </div>
          {endTime !== null && (
            <button
              type="button"
              onClick={() => setEndTime(null)}
              className="mt-2 text-xs text-slate-500 hover:text-slate-800 underline"
            >
              終了時間をリセット
            </button>
          )}
        </div>

        {/* 回転 */}
        <div className="rounded-md border border-slate-200 p-3">
          <p className="mb-2 text-sm font-medium text-slate-700">向き変更</p>
          <div className="flex gap-2">
            {rotations.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRotation(r)}
                className={`rounded border px-3 py-1.5 text-sm ${
                  rotation === r
                    ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                    : "border-slate-300 hover:bg-slate-100"
                }`}
              >
                {r}°
              </button>
            ))}
          </div>
        </div>

        {saving && (
          <p className="text-center text-sm text-slate-500">
            動画を処理中です。しばらくお待ちください...
          </p>
        )}
        {error && <p className="text-center text-xs text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded border px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "処理中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
