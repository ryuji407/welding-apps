"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ENVIRONMENTS,
  ROBOTS,
  type Environment,
  type ManualFormInitial,
  type RobotProgramEntry,
} from "@/lib/constants";
import { TOOLLESS_TOOL_CATEGORIES } from "@/lib/toollessTools";
import ToolCountInput from "@/components/ToolCountInput";
import { saveManual } from "@/app/actions/manual";

type EnvBlockState = ManualFormInitial["environmentBlocks"][number];

function programNumberError(value: string): string | null {
  if (!value) return null;
  if (/[^\x00-\x7F]/.test(value)) return "半角数字4桁で入力してください（全角不可）";
  if (/[^0-9]/.test(value)) return "数字のみ入力できます";
  if (value.length !== 4) return "4桁で入力してください";
  return null;
}

export default function ManualForm({
  initial,
  lockProcessCode = false,
  stickyHeader,
}: {
  initial: ManualFormInitial;
  lockProcessCode?: boolean;
  stickyHeader?: { itemName?: string | null; processName?: string | null };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ManualFormInitial>(initial);
  const [confirmAction, setConfirmAction] = useState<"end" | null>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // 治具レスツールカテゴリの開閉状態（初期値：固定ピンと入力済みのカテゴリを開く）
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => {
    const open = new Set<string>();
    // 固定ピンは常に開く
    open.add("fixing-pins");
    // 入力済みのカテゴリも開く
    for (const cat of TOOLLESS_TOOL_CATEGORIES) {
      const hasValue = cat.tools.some((t) => {
        const v = initial.toollessToolCounts[t.id];
        return v !== undefined && v !== "" && Number(v) > 0;
      });
      if (hasValue) open.add(cat.id);
    }
    return open;
  });

  function toggleCategory(catId: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }

  function toggleEnvironment(env: Environment) {
    setState((s) => {
      const has = s.robotEnvironments.includes(env);
      const robotEnvironments = has
        ? s.robotEnvironments.filter((e) => e !== env)
        : [...s.robotEnvironments, env].sort(
            (a, b) => ENVIRONMENTS.indexOf(a) - ENVIRONMENTS.indexOf(b),
          );
      const environmentBlocks = has
        ? s.environmentBlocks.filter((b) => b.environment !== env)
        : [
            ...s.environmentBlocks,
            { environment: env, robotPrograms: [], stepPhotos: {} },
          ].sort(
            (a, b) =>
              ENVIRONMENTS.indexOf(a.environment) -
              ENVIRONMENTS.indexOf(b.environment),
          );
      return { ...s, robotEnvironments, environmentBlocks };
    });
  }

  function updateBlock(env: Environment, fn: (b: EnvBlockState) => EnvBlockState) {
    setState((s) => ({
      ...s,
      environmentBlocks: s.environmentBlocks.map((b) =>
        b.environment === env ? fn(b) : b,
      ),
    }));
  }

  function changeStepCount(newCount: number) {
    if (newCount < 1 || newCount > 99) return;
    setState((s) => ({
      ...s,
      stepCount: newCount,
      environmentBlocks: s.environmentBlocks.map((b) => ({
        ...b,
        robotPrograms: b.robotPrograms.filter((rp) => rp.stepNumber <= newCount),
      })),
    }));
  }

  async function uploadSimplePhoto(kind: string, onSuccess: (url: string) => void, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    fd.append("processCode", state.processCode);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const { error } = await res.json();
      setError(error ?? "アップロードに失敗しました");
      return;
    }
    const { url } = await res.json();
    onSuccess(url);
  }

  async function uploadStepPhoto(env: Environment, stepNumber: number, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "program");
    fd.append("processCode", state.processCode);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const { error } = await res.json();
      setError(error ?? "アップロードに失敗しました");
      return;
    }
    const { url } = await res.json();
    updateBlock(env, (b) => ({
      ...b,
      stepPhotos: { ...b.stepPhotos, [stepNumber]: url },
    }));
  }

  async function uploadProgramPhoto(env: Environment, stepNumber: number, robot: string, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "program");
    fd.append("processCode", state.processCode);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const { error } = await res.json();
      setError(error ?? "アップロードに失敗しました");
      return;
    }
    const { url } = await res.json();
    updateRobotProgram(env, stepNumber, robot, { photoUrl: url });
  }

  function removeStepPhoto(env: Environment, stepNumber: number) {
    updateBlock(env, (b) => {
      const next = { ...b.stepPhotos };
      delete next[stepNumber];
      return { ...b, stepPhotos: next };
    });
  }

  function toggleRobot(env: Environment, stepNumber: number, robot: string) {
    updateBlock(env, (b) => {
      const exists = b.robotPrograms.some(
        (rp) => rp.stepNumber === stepNumber && rp.robot === robot,
      );
      return {
        ...b,
        robotPrograms: exists
          ? b.robotPrograms.filter(
              (rp) => !(rp.stepNumber === stepNumber && rp.robot === robot),
            )
          : [...b.robotPrograms, { stepNumber, robot, number: "", name: "" }],
      };
    });
  }

  function updateRobotProgram(
    env: Environment,
    stepNumber: number,
    robot: string,
    patch: Partial<RobotProgramEntry>,
  ) {
    updateBlock(env, (b) => ({
      ...b,
      robotPrograms: b.robotPrograms.map((rp) =>
        rp.stepNumber === stepNumber && rp.robot === robot
          ? { ...rp, ...patch }
          : rp,
      ),
    }));
  }

  function doSave() {
    setError(null);
    const code = state.processCode.trim();
    if (!code) {
      setError("工程コードを入力してください");
      return;
    }

    startTransition(async () => {
      try {
        await saveManual({
          processCode: code,
          productName: state.productName || null,
          toollessToolCounts: Object.fromEntries(
            Object.entries(state.toollessToolCounts)
              .filter(([, v]) => v !== "" && !Number.isNaN(Number(v)) && Number(v) >= 0)
              .map(([k, v]) => [k, Number(v)]),
          ),
          robotEnvironments: state.robotEnvironments,
          notes: state.notes || null,
          toollessToolColor: state.toollessToolColor || null,
          workVideoUrl: state.workVideoUrl || null,
          layoutPhotoUrl: state.layoutPhotoUrl || null,
          environmentBlocks: state.environmentBlocks.map((b) => ({
            environment: b.environment,
            stepPhotos: b.stepPhotos ?? {},
            robotPrograms: b.robotPrograms.flatMap((rp) => {
              if (!(ROBOTS as readonly string[]).includes(rp.robot)) return [];
              return [{
                stepNumber: rp.stepNumber,
                robot: rp.robot as (typeof ROBOTS)[number],
                number: rp.number || null,
                name: rp.name || null,
                photoUrl: rp.photoUrl || null,
              }];
            }),
          })),
          jigProcessSteps: Array.from({ length: state.stepCount }, (_, i) => ({
            stepNumber: i + 1,
          })),
          aliases: state.aliases,
        });
        router.push(`/manual/${encodeURIComponent(code)}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "保存に失敗しました");
      }
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
  }

  return (
    <>
    <form id="manual-form" onSubmit={onSubmit} className="space-y-8">
      {stickyHeader && (
        <div
          className="sticky top-[61px] z-10 bg-blue-500 py-4 text-white"
          style={{ marginLeft: "calc(-50vw + 50%)", marginRight: "calc(-50vw + 50%)", width: "100vw" }}
        >
          <div className="mx-auto flex max-w-6xl items-start justify-between gap-4 px-6">
            <p className="text-2xl font-bold tracking-wide">
              {[stickyHeader.itemName, stickyHeader.processName].filter(Boolean).join("　")}
            </p>
            <button
              type="button"
              onClick={() => setConfirmAction("end")}
              className="shrink-0 rounded-md bg-white px-3 py-1 text-sm font-medium text-blue-600 hover:bg-slate-100"
            >
              編集終了
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Section id="tool-counts" title="ツール使用数">
        <div className="space-y-2">
          {TOOLLESS_TOOL_CATEGORIES.map((cat) => {
            const isOpen = openCategories.has(cat.id);
            const usedCount = cat.tools.filter((t) => {
              const v = state.toollessToolCounts[t.id];
              return v !== undefined && v !== "" && Number(v) > 0;
            }).length;
            return (
              <div key={cat.id} className={`rounded-md border border-l-4 ${cat.accentColor} border-slate-200 bg-white`}>
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    {cat.label}
                    {usedCount > 0 && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                        {usedCount}種使用
                      </span>
                    )}
                  </span>
                  <svg
                    className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {cat.tools.map((tool) => (
                        <ToolCountInput
                          key={tool.id}
                          tool={tool}
                          value={state.toollessToolCounts[tool.id] ?? ""}
                          onChange={(v) =>
                            setState((s) => ({
                              ...s,
                              toollessToolCounts: { ...s.toollessToolCounts, [tool.id]: v },
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="layout" title="全体レイアウト">
        <PhotoSlot
          url={state.layoutPhotoUrl}
          onUpload={(f) => uploadSimplePhoto("layout", (url) => setState((s) => ({ ...s, layoutPhotoUrl: url })), f)}
          onRemove={() => setState((s) => ({ ...s, layoutPhotoUrl: "" }))}
        />
      </Section>

      <Section id="process" title="工程">
        <div className="space-y-2">
          {ENVIRONMENTS.map((env) => {
            const isOpen = state.robotEnvironments.includes(env);
            const block = state.environmentBlocks.find((b) => b.environment === env);
            const envMissing = new Set<string>();
            if (block != null) {
              Array.from({ length: state.stepCount }, (_, i) => i + 1).forEach((stepNum) => {
                const programsForStep = block.robotPrograms.filter(rp => rp.stepNumber === stepNum);
                if (programsForStep.length === 0) return;
                if (programsForStep.some(rp => !rp.number)) envMissing.add("プログラム番号");
                if (programsForStep.some(rp => !rp.name)) envMissing.add("プログラム名称");
                if (!block.stepPhotos[stepNum]) envMissing.add("写真");
              });
            }
            const envHasMissing = envMissing.size > 0;
            const envMissingText = Array.from(envMissing).join("、");
            return (
              <div key={env} className="rounded-md border border-slate-200">
                <button
                  type="button"
                  onClick={() => toggleEnvironment(env)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    {env}環境
                    {envHasMissing && (
                      <span className="text-xs text-red-600">
                        ⚠ 不足：{envMissingText}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-slate-400">{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && block && (
                  <div className="space-y-3 p-4">
                    {Array.from({ length: state.stepCount }, (_, i) => i + 1).map((stepNum) => (
                      <div
                        key={stepNum}
                        className="rounded border border-slate-100 bg-white p-3 space-y-2"
                      >
                        {/* ── 行1: ステップ番号 ── */}
                        <div className="text-sm font-medium text-slate-600">工程{stepNum}</div>
                        {/* ── 行2: ロボット選択（自由に拡張） ── */}
                        <div className="space-y-1 pl-1">
                        {ROBOTS.map((r) => {
                          const rp = block.robotPrograms.find(
                            (x) => x.stepNumber === stepNum && x.robot === r,
                          );
                          const selected = !!rp;
                          return (
                            <div key={r} className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleRobot(block.environment, stepNum, r)}
                                className={`rounded border px-2.5 py-1 text-sm font-medium whitespace-nowrap transition-colors ${
                                  selected
                                    ? "border-blue-500 bg-blue-500 text-white"
                                    : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
                                }`}
                              >
                                {r}
                              </button>
                              {selected && rp && (
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                  <label className="flex items-center gap-1 whitespace-nowrap">
                                    <span className="text-slate-500">プログラム番号</span>
                                    <input
                                      type="text"
                                      value={rp.number}
                                      maxLength={4}
                                      onChange={(e) =>
                                        updateRobotProgram(block.environment, stepNum, r, {
                                          number: e.target.value,
                                        })
                                      }
                                      className={`w-20 rounded-md border px-2 py-1 ${
                                        programNumberError(rp.number)
                                          ? "border-red-400 bg-red-50"
                                          : "border-slate-300"
                                      }`}
                                    />
                                  </label>
                                  <label className="flex items-center gap-1 whitespace-nowrap">
                                    <span className="text-slate-500">プログラム名称</span>
                                    <input
                                      type="text"
                                      value={rp.name}
                                      onChange={(e) =>
                                        updateRobotProgram(block.environment, stepNum, r, {
                                          name: e.target.value,
                                        })
                                      }
                                      className="w-40 rounded-md border border-slate-300 px-2 py-1"
                                    />
                                  </label>
                                  {programNumberError(rp.number) && (
                                    <p className="w-full text-xs text-red-600">
                                      {programNumberError(rp.number)}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        </div>
                        {/* ── 行3: 写真アップロード + 最終工程なら追加/削除ボタン ── */}
                        {block.stepPhotos[stepNum] ? (
                          <div className="relative w-full max-w-xs">
                            <img
                              src={block.stepPhotos[stepNum]}
                              alt="工程写真"
                              className="w-full rounded-md object-cover border border-slate-200 max-h-48"
                            />
                            <button
                              type="button"
                              onClick={() => removeStepPhoto(block.environment, stepNum)}
                              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white text-xs hover:bg-black/70"
                            >
                              ×
                            </button>
                            <label className="absolute bottom-1 right-1 cursor-pointer rounded bg-black/50 px-2 py-0.5 text-xs text-white hover:bg-black/70">
                              変更
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) uploadStepPhoto(block.environment, stepNum, f);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </div>
                        ) : (
                          <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-6 text-slate-400 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-500 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5M13.5 3.75h3.75A1.5 1.5 0 0118.75 5.25v3.75" />
                            </svg>
                            <span className="text-sm">写真をアップロード</span>
                            <span className="text-xs">クリックして選択 / 撮影</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadStepPhoto(block.environment, stepNum, f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                        {stepNum === state.stepCount && (
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => changeStepCount(state.stepCount + 1)}
                              disabled={state.stepCount >= 99}
                              className="flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-30"
                            >
                              ＋ 工程を追加
                            </button>
                            {state.stepCount > 1 && (
                              <button
                                type="button"
                                onClick={() => changeStepCount(state.stepCount - 1)}
                                className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                              >
                                この工程を削除
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="video" title="作業動画">
        {/* アップロード済み or URL動画のプレビュー */}
        {state.workVideoUrl && (
          <div className="relative mb-3 w-full max-w-md">
            {state.workVideoUrl.startsWith("/api/files/") ? (
              <video
                src={state.workVideoUrl}
                controls
                className="w-full rounded-lg border border-slate-200 bg-black max-h-64"
              />
            ) : (
              <a
                href={state.workVideoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-blue-700 hover:bg-slate-100 hover:underline"
              >
                🔗 {state.workVideoUrl}
              </a>
            )}
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, workVideoUrl: "" }))}
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white text-sm hover:bg-black/70"
            >
              ×
            </button>
          </div>
        )}
        {/* ファイルアップロード枠 */}
        {!state.workVideoUrl && (
          <label className="mb-3 flex w-full max-w-md cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 py-8 text-slate-400 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z" />
            </svg>
            <span className="text-sm font-medium">動画をアップロード / 撮影</span>
            <span className="text-xs">クリックして選択（25MB以内）</span>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadSimplePhoto("video", (url) => setState((s) => ({ ...s, workVideoUrl: url })), f);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </Section>

      <Section id="wagon" title="ワゴン積載方法">
        <PhotoSlot
          url={state.wagonPhotoUrl}
          onUpload={(f) => uploadSimplePhoto("wagon", (url) => setState((s) => ({ ...s, wagonPhotoUrl: url })), f)}
          onRemove={() => setState((s) => ({ ...s, wagonPhotoUrl: "" }))}
        />
      </Section>

      <Section id="notes" title="注意点">
        <div className="flex h-36 gap-2">
          <textarea
            value={state.notes}
            onChange={(e) => setState({ ...state, notes: e.target.value })}
            className="h-full flex-1 resize-none rounded-md border border-slate-300 px-3 py-2"
          />
          {/* 写真アップロードボタン（右端・正方形） */}
          <label
            className="flex h-full w-36 shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 text-slate-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            title="写真をアップロード"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5M13.5 3.75h3.75A1.5 1.5 0 0118.75 5.25v3.75" />
            </svg>
            <span className="text-sm font-medium">写真</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadSimplePhoto("notes", (url) => setState((s) => ({ ...s, notesPhotoUrl: url })), f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {/* アップロード済み写真のサムネイル */}
        {state.notesPhotoUrl && (
          <div className="relative mt-2 w-full max-w-md">
            <img
              src={state.notesPhotoUrl}
              alt="注意点写真"
              className="w-full rounded-lg object-contain border border-slate-200 bg-slate-50 max-h-64"
            />
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, notesPhotoUrl: "" }))}
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white text-sm hover:bg-black/70"
            >
              ×
            </button>
            <label className="absolute bottom-2 right-2 cursor-pointer rounded-md bg-black/50 px-2 py-1 text-xs text-white hover:bg-black/70">
              変更
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadSimplePhoto("notes", (url) => setState((s) => ({ ...s, notesPhotoUrl: url })), f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        )}
      </Section>

      <div>
        <button
          type="button"
          onClick={() => setConfirmAction("end")}
          className="rounded-md bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700"
        >
          編集終了
        </button>
      </div>

    </form>

    {confirmAction && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
          <p className="mb-6 text-center font-medium text-slate-800">変更内容を保存しますか？</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => { setConfirmAction(null); doSave(); }}
              className="rounded-md border border-blue-600 bg-white py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => { setConfirmAction(null); router.back(); }}
              className="rounded-md border border-slate-800 bg-white py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              破棄して終了
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              className="rounded-md border border-slate-800 bg-white py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function Section({
  id,
  title,
  children,
  extra,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-3 rounded-md border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold">{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function PhotoSlot({
  url,
  onUpload,
  onRemove,
}: {
  url: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) onUpload(f);
    e.target.value = "";
  }

  if (url) {
    return (
      <div className="relative mt-2 w-full max-w-md">
        <img
          src={url}
          alt="写真"
          className="w-full rounded-lg object-contain border border-slate-200 bg-slate-50 max-h-64"
        />
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white text-sm hover:bg-black/70"
        >
          ×
        </button>
        <label className="absolute bottom-2 right-2 cursor-pointer rounded-md bg-black/50 px-2 py-1 text-xs text-white hover:bg-black/70">
          変更
          <input type="file" accept="image/*" className="hidden" onChange={handleChange} />
        </label>
      </div>
    );
  }

  return (
    <label className="mt-2 flex w-full max-w-md cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 py-10 text-slate-400 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-500 transition-colors">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 19.5h16.5M13.5 3.75h3.75A1.5 1.5 0 0118.75 5.25v3.75" />
      </svg>
      <span className="text-sm font-medium">写真をアップロード</span>
      <span className="text-xs">クリックして選択 / 撮影</span>
      <input type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </label>
  );
}
