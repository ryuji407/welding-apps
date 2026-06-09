"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteManual } from "@/app/actions/manual";

export default function DeleteButton({ processCode }: { processCode: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="shrink-0 rounded-md bg-white/20 px-3 py-1 text-sm font-medium text-white hover:bg-red-600"
      >
        削除
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-1">
      <span className="text-sm text-white">本当に削除しますか？</span>
      <button
        onClick={() => {
          startTransition(async () => {
            await deleteManual(processCode);
            router.push("/");
          });
        }}
        disabled={isPending}
        className="rounded bg-red-600 px-3 py-0.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? "削除中…" : "はい"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        disabled={isPending}
        className="rounded bg-white/20 px-3 py-0.5 text-sm font-medium text-white hover:bg-white/30"
      >
        キャンセル
      </button>
    </div>
  );
}
