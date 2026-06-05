"use client";

import { useState, useRef } from "react";
import type { ToollessToolEntry } from "@/lib/toollessTools";

export default function ToolCountInput({
  tool,
  value,
  onChange,
}: {
  tool: ToollessToolEntry;
  value: string;
  onChange: (next: string) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const count = value === "" ? 0 : Number(value);

  function increment() {
    onChange(String(count + 1));
  }

  function decrement() {
    if (count <= 0) return;
    onChange(String(count - 1));
  }

  function handleDirectInput(v: string) {
    // 空文字 or 数字のみ許可
    if (v === "" || /^\d+$/.test(v)) {
      onChange(v);
    }
  }

  function handleBlur() {
    setEditing(false);
    // 空文字は 0 に
    if (value === "") onChange("0");
  }

  const image = imgFailed ? (
    <div className="h-16 w-full bg-slate-100 flex items-center justify-center rounded">
      <svg className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" />
      </svg>
    </div>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tool.imageUrl}
      alt={tool.label}
      className="h-16 w-full object-contain"
      onError={() => setImgFailed(true)}
    />
  );

  const isZero = count === 0;

  const wrapper = tool.highlight
    ? "relative rounded-md border-2 border-yellow-400 bg-yellow-50 p-2 shadow-sm"
    : "rounded-md border border-slate-200 bg-slate-50 p-2";

  const labelClass = tool.highlight
    ? "text-xs font-bold text-yellow-900 text-center"
    : "text-xs font-medium text-slate-800 text-center";

  return (
    <div className={wrapper}>
      <div className="flex flex-col items-center gap-1">
        {image}
        <span className={labelClass}>{tool.label}</span>

        {/* ステッパー */}
        <div className="flex w-full items-center rounded border border-slate-300 overflow-hidden">
          {/* マイナスボタン */}
          <button
            type="button"
            onClick={decrement}
            disabled={isZero}
            className={`flex-none w-9 h-9 flex items-center justify-center text-lg font-bold transition-colors
              ${isZero
                ? "text-slate-300 bg-slate-100 cursor-not-allowed"
                : "text-slate-600 bg-white active:bg-slate-100"
              }`}
          >
            −
          </button>

          {/* 数値表示 or 直接入力 */}
          {editing ? (
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              value={value}
              onChange={(e) => handleDirectInput(e.target.value)}
              onBlur={handleBlur}
              className="flex-1 h-9 text-center text-sm font-semibold bg-white border-x border-slate-300 outline-none focus:bg-blue-50"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setTimeout(() => inputRef.current?.select(), 0);
              }}
              className={`flex-1 h-9 text-center text-sm font-semibold border-x border-slate-300 transition-colors
                ${isZero ? "text-slate-400 bg-white" : "text-slate-900 bg-white"}`}
            >
              {isZero ? "0" : count}
            </button>
          )}

          {/* プラスボタン */}
          <button
            type="button"
            onClick={increment}
            className="flex-none w-9 h-9 flex items-center justify-center text-lg font-bold text-slate-600 bg-white active:bg-slate-100 transition-colors"
          >
            ＋
          </button>
        </div>
      </div>
    </div>
  );
}
