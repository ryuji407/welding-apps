import Link from "next/link";
import MediaUploader from "@/components/MediaUploader";
import VideoUploader from "@/components/VideoUploader";
import EditButton from "@/components/EditButton";
import DeleteButton from "@/components/DeleteButton";
import { getManualByCode, parseJsonArray } from "@/lib/manual";
import { parseJsonRecord } from "@/lib/constants";
import { TOOLLESS_TOOL_CATEGORIES } from "@/lib/toollessTools";
import { findByProcessCode, searchMaster } from "@/lib/master";

export const dynamic = "force-dynamic";

export default async function ManualViewPage({
  params,
}: {
  params: Promise<{ processCode: string }>;
}) {
  const { processCode: raw } = await params;
  const processCode = decodeURIComponent(raw);
  const manual = await getManualByCode(processCode);

  if (!manual) {
    // 色品番違い（同プレフィックス・同サフィックス）を検索
    const parts = processCode.split("-");
    let colorVariants: string[] = [processCode];
    if (parts.length >= 3 && parts[1].length === 3) {
      const prefix = parts[0];
      const suffix = parts.slice(2).join("-");
      const { rows } = searchMaster({ processCode: prefix });
      const variants = rows
        .filter((r) => {
          const p = r.processCode.split("-");
          return p.length >= 3 && p[1].length === 3 && p[0] === prefix && p.slice(2).join("-") === suffix;
        })
        .map((r) => r.processCode);
      if (variants.length > 0) {
        colorVariants = [processCode, ...variants.filter((c) => c !== processCode)];
      }
    }
    const [primary, ...aliasVariants] = colorVariants;
    const createUrl = aliasVariants.length > 0
      ? `/manual/new?processCode=${encodeURIComponent(primary)}&aliases=${encodeURIComponent(aliasVariants.join(","))}`
      : `/manual/new?processCode=${encodeURIComponent(primary)}`;

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">マニュアル未登録</h1>
        <p className="text-slate-600">
          工程コード <code className="rounded bg-slate-100 px-2 py-0.5">{processCode}</code>{" "}
          のマニュアルはまだ登録されていません。
        </p>
        {colorVariants.length > 1 && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p className="mb-2 font-medium text-slate-700">色品番違い（同時登録対象）</p>
            <div className="flex flex-wrap gap-2">
              {colorVariants.map((code) => (
                <code key={code} className="rounded bg-white border border-slate-200 px-2 py-0.5 text-xs text-blue-700">
                  {code}
                </code>
              ))}
            </div>
          </div>
        )}
        <Link
          href={createUrl}
          className="inline-block rounded-md bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700"
        >
          {colorVariants.length > 1 ? `${colorVariants.length} 件まとめて作成する` : "このコードで作成する"}
        </Link>
      </div>
    );
  }

  const toollessCounts = parseJsonRecord(manual.toollessToolCounts);
  const hasAnyToolCount = TOOLLESS_TOOL_CATEGORIES.some((cat) =>
    cat.tools.some((t) => Number(toollessCounts[t.id]) > 0),
  );
  // mediaFilesに加え、フォームから保存された単体URLもマージ（重複除外）
  const layoutImages = [
    ...manual.mediaFiles.filter((m) => m.kind === "layout"),
    ...(manual.layoutPhotoUrl && !manual.mediaFiles.some((m) => m.url === manual.layoutPhotoUrl)
      ? [{ id: "__form_layout", url: manual.layoutPhotoUrl, filename: "全体レイアウト" }]
      : []),
  ];
  const wagonImages = [
    ...manual.mediaFiles.filter((m) => m.kind === "wagon"),
    ...(manual.wagonPhotoUrl && !manual.mediaFiles.some((m) => m.url === manual.wagonPhotoUrl)
      ? [{ id: "__form_wagon", url: manual.wagonPhotoUrl, filename: "ワゴン積載" }]
      : []),
  ];
  const videoFiles = manual.mediaFiles.filter((m) => m.kind === "video");
  const jigByStep = new Map<number, typeof manual.jigProcessSteps[number]>();
  for (const step of manual.jigProcessSteps) {
    jigByStep.set(step.stepNumber, step);
  }
  const master = findByProcessCode(manual.processCode);
  const nameMismatch =
    master && manual.productName && master.itemName !== manual.productName;

  return (
    <div className="space-y-6">
      {master && (master.itemName || master.processName) && (
        <div
          className="sticky top-[61px] z-10 bg-blue-500 py-4 text-white"
          style={{ marginLeft: "calc(-50vw + 50%)", marginRight: "calc(-50vw + 50%)", width: "100vw" }}
        >
          <div className="mx-auto flex max-w-6xl items-start justify-between gap-4 px-6">
            <p className="text-2xl font-bold tracking-wide">
              {[master.itemName, master.processName].filter(Boolean).join("　")}
            </p>
            <div className="flex items-center gap-2">
              <EditButton processCode={manual.processCode} />
              <DeleteButton processCode={manual.processCode} />
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500">
        最終更新: {manual.updatedAt.toLocaleString("ja-JP")}
      </p>

      {master ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
          <h2 className="mb-2 font-bold">マスタ情報</h2>
          {nameMismatch && (
            <div className="mb-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
              ⚠ マスタの品目名称（<strong>{master.itemName}</strong>）と
              マニュアル保存値（<strong>{manual.productName}</strong>）が一致しません。
            </div>
          )}
          <div className="space-y-1">
            <dl className="flex flex-wrap gap-x-8 gap-y-1">
              <Info label="工程コード" value={master.processCode} mono />
              <Info label="SHOP" value={master.shop ?? "—"} />
              <Info label="構成数" value={master.usageCount !== null ? `${master.usageCount}` : "—"} />
            </dl>
            <dl className="flex flex-wrap gap-x-8 gap-y-1">
              <Info label="段取り時間" value={master.setupTime !== null ? `${master.setupTime} 分` : "—"} />
              <Info label="サイクルタイム" value={master.cycleTime !== null ? `${master.cycleTime} 秒` : "—"} />
              <Info label="作業人数" value={master.workerCount !== null ? `${master.workerCount} 名` : "—"} />
            </dl>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          この工程コードは現行マスタに存在しません（廃番または削除済みの可能性）。
        </div>
      )}

      <ViewSection id="tool-counts" title="ツール使用数">
        {!hasAnyToolCount ? (
          <p className="text-sm text-slate-500">未入力</p>
        ) : (
          <div className="space-y-3">
            {TOOLLESS_TOOL_CATEGORIES.map((cat) => {
              const used = cat.tools.filter((t) => Number(toollessCounts[t.id]) > 0);
              if (used.length === 0) return null;
              return (
                <div key={cat.id}>
                  <h4 className="mb-1 text-xs font-bold text-slate-500">{cat.label}</h4>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {used.map((t) => (
                      <span
                        key={t.id}
                        className={
                          t.highlight
                            ? "rounded bg-yellow-100 px-2 py-0.5 font-bold text-yellow-900"
                            : ""
                        }
                      >
                        <span className="text-slate-600">{t.label}</span>{" "}
                        <span className="text-base font-bold">{toollessCounts[t.id]}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ViewSection>

      <ViewSection id="layout" title="全体レイアウト">
        <MediaUploader
          images={layoutImages}
          kind="layout"
          manualId={manual.id}
          processCode={manual.processCode}
          readonly
        />
      </ViewSection>

      <ViewSection
        id="process"
        title="工程"
        titleExtra={
          manual.environmentBlocks.some((block) =>
            block.programs.length === 0 ||
            block.programs.some((p) => {
              const robots = parseJsonArray(p.robots);
              return robots.length === 0 || !p.number || !p.name;
            })
          ) ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              記載漏れあり
            </span>
          ) : undefined
        }
      >
        {manual.toollessToolColor && (
          <p className="mb-2 text-sm">
            <span className="font-medium">治具レス用ツールカラー:</span>{" "}
            {manual.toollessToolColor}
          </p>
        )}
        {manual.environmentBlocks.length === 0 ? (
          <p className="text-slate-500">未設定</p>
        ) : (
          <div className="space-y-2">
            {manual.environmentBlocks.map((block) => {
              const byStep = new Map<number, typeof block.programs>();
              for (const p of block.programs) {
                if (!byStep.has(p.stepNumber)) byStep.set(p.stepNumber, []);
                byStep.get(p.stepNumber)!.push(p);
              }
              const sortedSteps = [...byStep.keys()].sort((a, b) => a - b);
              // フォームから保存された工程写真（environmentBlock.stepPhotos JSON）
              const blockStepPhotos: Record<string, string> = (() => {
                try { const v = JSON.parse(block.stepPhotos); return v && typeof v === "object" ? v : {}; } catch { return {}; }
              })();
              const missingItems = new Set<string>();
              sortedSteps.forEach((stepNum) => {
                const progs = byStep.get(stepNum)!;
                const jigStep = jigByStep.get(stepNum);
                if (progs.some(p => {
                  const robots = parseJsonArray(p.robots);
                  return robots.length === 0;
                })) missingItems.add("号機");
                if (progs.some(p => !p.number)) missingItems.add("プログラム番号");
                if (progs.some(p => !p.name)) missingItems.add("プログラム名称");
                const hasPhoto = (jigStep && jigStep.images.length > 0) || !!blockStepPhotos[String(stepNum)];
                if (!hasPhoto) missingItems.add("写真");
              });
              const hasMissing = missingItems.size > 0;
              const missingText = Array.from(missingItems).join("、");
              return (
                <details key={block.id} className="rounded-md border border-slate-200">
                  <summary className="cursor-pointer select-none rounded-md px-4 py-3 font-semibold hover:bg-slate-50">
                    <span className="inline-flex items-center gap-2">
                      {block.environment}環境
                      {hasMissing && (
                        <span className="text-xs text-red-600">
                          ⚠ 不足：{missingText}
                        </span>
                      )}
                    </span>
                  </summary>
                  <div className="space-y-3 px-4 pb-4 pt-2">
                    {sortedSteps.length === 0 ? (
                      <p className="text-sm text-slate-500">プログラム未設定</p>
                    ) : (
                      sortedSteps.map((stepNum) => {
                        const jigStep = jigByStep.get(stepNum);
                        const progs = byStep.get(stepNum)!;
                        const stepPhotoUrl = blockStepPhotos[String(stepNum)];
                        const hasPhoto = (jigStep && jigStep.images.length > 0) || !!stepPhotoUrl;
                        const missingItems: string[] = [];
                        if (progs.some(p => !p.number)) missingItems.push("プログラム番号");
                        if (progs.some(p => !p.name))   missingItems.push("プログラム名称");
                        if (!hasPhoto) missingItems.push("写真");
                        return (
                          <div key={stepNum} className="rounded border border-slate-100 bg-slate-50 p-3">
                            <div className="mb-2 text-xs font-bold text-slate-500">工程{stepNum}</div>
                            <div className="mb-3 space-y-1">
                              {progs.map((p) => {
                                const robots = parseJsonArray(p.robots);
                                return (
                                  <div key={p.id} className="text-sm">
                                    <span className="font-medium">{robots[0] ?? "—"}</span>
                                    {"　"}
                                    <span className="text-slate-500">番号:</span>{" "}
                                    {p.number ?? "—"}
                                    {"　"}
                                    <span className="text-slate-500">名称:</span>{" "}
                                    {p.name ?? "—"}
                                  </div>
                                );
                              })}
                            </div>
                            {/* フォームから保存された工程写真 */}
                            {stepPhotoUrl && (
                              <a href={stepPhotoUrl} target="_blank" rel="noopener noreferrer" className="mb-2 block">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={stepPhotoUrl} alt={`工程${stepNum}写真`} className="w-full rounded-md border border-slate-200 object-contain" />
                              </a>
                            )}
                            {jigStep && (
                              <MediaUploader
                                images={jigStep.images}
                                kind="jig"
                                jigStepId={jigStep.id}
                                processCode={manual.processCode}
                                readonly
                              />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </ViewSection>

      <ViewSection id="video" title="作業動画">
        <VideoUploader
          videos={videoFiles}
          manualId={manual.id}
          processCode={manual.processCode}
          workVideoUrl={manual.workVideoUrl}
          readonly
        />
      </ViewSection>

      <ViewSection id="wagon" title="ワゴン積載方法">
        <MediaUploader
          images={wagonImages}
          kind="wagon"
          manualId={manual.id}
          processCode={manual.processCode}
          readonly
        />
      </ViewSection>

      <ViewSection id="notes" title="注意点" highlight={!!manual.notes} dim={!manual.notes}>
        {manual.notes ? (
          <p className="whitespace-pre-wrap">{manual.notes}</p>
        ) : (
          <p className="text-slate-500">なし</p>
        )}
        {manual.notesPhotoUrl && (
          <a href={manual.notesPhotoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={manual.notesPhotoUrl} alt="注意点写真" className="w-full rounded-md border border-slate-200 object-contain" />
          </a>
        )}
      </ViewSection>
    </div>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-0">
      <dt className="shrink-0 text-slate-500">{label}：</dt>
      <dd className={mono ? "font-mono" : ""}>{value}</dd>
    </div>
  );
}

function ViewSection({
  id,
  title,
  children,
  highlight = false,
  dim = false,
  titleExtra,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
  highlight?: boolean;
  dim?: boolean;
  titleExtra?: React.ReactNode;
}) {
  return (
    <section id={id} className={`space-y-2 rounded-md border-2 bg-white p-5 ${highlight ? "border-amber-400 shadow-md shadow-amber-100" : "border-slate-200"} ${dim ? "opacity-40" : ""}`}>
      <div className="flex items-center gap-2">
        <h2 className={`text-lg font-bold ${highlight ? "text-amber-700" : ""}`}>{title}</h2>
        {titleExtra}
      </div>
      {children}
    </section>
  );
}

