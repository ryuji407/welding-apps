"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMedia } from "@/app/actions/media";

type Media = { id: string; url: string; filename: string };

export default function MediaUploader({
  images,
  kind,
  manualId,
  jigStepId,
  processCode,
  showCapture = false,
  readonly = false,
}: {
  images: Media[];
  kind: "layout" | "wagon" | "jig";
  manualId?: string;
  jigStepId?: string;
  processCode: string;
  showCapture?: boolean;
  readonly?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", kind);
        if (manualId) fd.append("manualId", manualId);
        if (jigStepId) fd.append("jigStepId", jigStepId);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? "アップロード失敗");
        }
      }
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロード失敗");
    } finally {
      setUploading(false);
    }
  }

  function onDelete(id: string) {
    if (!confirm("この画像を削除しますか？")) return;
    startTransition(async () => {
      await deleteMedia(id, processCode);
      router.refresh();
    });
  }

  if (readonly) {
    return (
      <div className="space-y-2">
        {images.length === 0 ? (
          <p className="text-sm text-slate-400">なし</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {images.map((img) => (
              <div key={img.id} className="aspect-video overflow-hidden rounded border border-slate-200">
                <a href={img.url} target="_blank" rel="noopener noreferrer" className="block h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.filename} className="h-full w-full object-cover" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {images.length === 0 ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-10 text-slate-400 hover:border-slate-400 hover:bg-slate-50">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium">写真をアップロード</span>
          <span className="text-xs">クリックして選択 / 撮影</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-video overflow-hidden rounded border border-slate-200"
              >
                <a href={img.url} target="_blank" rel="noopener noreferrer" className="block h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.filename}
                    className="h-full w-full object-cover"
                  />
                </a>
                <button
                  type="button"
                  onClick={() => onDelete(img.id)}
                  disabled={pending}
                  className="absolute right-1 top-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white opacity-0 group-hover:opacity-100"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
              📎 追加
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onChange}
                disabled={uploading}
                className="hidden"
              />
            </label>
            {showCapture && (
              <label className="flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
                📷 撮影する
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onChange}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            )}
            {uploading && <span className="text-xs text-slate-500">アップロード中...</span>}
          </div>
        </>
      )}
      {uploading && images.length === 0 && <span className="text-xs text-slate-500">アップロード中...</span>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
