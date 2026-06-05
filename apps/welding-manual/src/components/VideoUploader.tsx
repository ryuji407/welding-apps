"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMedia } from "@/app/actions/media";

type Media = { id: string; url: string; filename: string };

export default function VideoUploader({
  videos,
  manualId,
  processCode,
  workVideoUrl,
  readonly = false,
}: {
  videos: Media[];
  manualId: string;
  processCode: string;
  workVideoUrl?: string | null;
  readonly?: boolean;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "video");
      fd.append("manualId", manualId);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "アップロード失敗");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロード失敗");
    } finally {
      setUploading(false);
    }
  }

  function onDelete(id: string) {
    if (!confirm("この動画を削除しますか？")) return;
    startTransition(async () => {
      await deleteMedia(id, processCode);
      router.refresh();
    });
  }

  if (readonly) {
    return (
      <div className="space-y-3">
        {workVideoUrl && (
          <a href={workVideoUrl} target="_blank" rel="noopener noreferrer" className="block text-blue-700 hover:underline text-sm">
            🔗 {workVideoUrl}
          </a>
        )}
        {videos.length > 0 ? (
          <div className="space-y-2">
            {videos.map((v) => (
              <div key={v.id} className="rounded-md border border-slate-200 overflow-hidden">
                <video src={v.url} controls className="aspect-video w-full" />
              </div>
            ))}
          </div>
        ) : !workVideoUrl ? (
          <p className="text-sm text-slate-400">なし</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* URL埋め込み動画 */}
      {workVideoUrl && (
        <a
          href={workVideoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-blue-700 hover:underline text-sm"
        >
          🔗 {workVideoUrl}
        </a>
      )}

      {/* アップロード済み動画 */}
      {videos.length > 0 && (
        <div className="space-y-2">
          {videos.map((v) => (
            <div key={v.id} className="group relative rounded-md border border-slate-200 overflow-hidden">
              <video
                src={v.url}
                controls
                className="aspect-video w-full"
              />
              <button
                type="button"
                onClick={() => onDelete(v.id)}
                disabled={pending}
                className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white opacity-0 group-hover:opacity-100"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}

      {videos.length === 0 && !workVideoUrl ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-10 text-slate-400 hover:border-slate-400 hover:bg-slate-50">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.677v6.646a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
          <span className="text-sm font-medium">動画をアップロード</span>
          <span className="text-xs">クリックして選択 / 撮影</span>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
            📎 動画を追加
            <input
              type="file"
              accept="video/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
            🎥 撮影する
            <input
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
          {uploading && <span className="text-xs text-slate-500">アップロード中...</span>}
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
