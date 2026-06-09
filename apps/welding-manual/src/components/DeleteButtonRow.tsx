"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteManual } from "@/app/actions/manual";

export default function DeleteButtonRow({ processCode }: { processCode: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <button
        onClick={(e) => { e.preventDefault(); setConfirming(true); }}
        className="relative z-10 rounded px-2 py-0.5 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
      >
        削除
      </button>
    );
  }

  return (
    <span className="relative z-10 inline-flex items-center gap-1">
      <span className="text-xs text-slate-600">削除しますか？</span>
      <button
        onClick={(e) => {
          e.preventDefault();
          startTransition(async () => {
            await deleteManual(processCode);
            router.refresh();
          });
        }}
        disabled={isPending}
        className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? "削除中…" : "はい"}
      </button>
      <button
        onClick={(e) => { e.preventDefault(); setConfirming(false); }}
        disabled={isPending}
        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs hover:bg-slate-100"
      >
        戻る
      </button>
    </span>
  );
}
