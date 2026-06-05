import { notFound } from "next/navigation";
import ManualForm from "@/components/ManualForm";
import {
  ENVIRONMENTS,
  parseJsonArray,
  parseJsonRecord,
  type Environment,
  type ManualFormInitial,
} from "@/lib/constants";
import { getManualByCode } from "@/lib/manual";
import { findByProcessCode } from "@/lib/master";

export const dynamic = "force-dynamic";

export default async function EditManualPage({
  params,
}: {
  params: Promise<{ processCode: string }>;
}) {
  const { processCode: raw } = await params;
  const processCode = decodeURIComponent(raw);
  const manual = await getManualByCode(processCode);
  if (!manual) notFound();

  const envs = parseJsonArray(manual.robotEnvironments).filter((e): e is Environment =>
    (ENVIRONMENTS as readonly string[]).includes(e),
  );

  const stepCount = manual.jigProcessSteps.length > 0
    ? Math.max(...manual.jigProcessSteps.map((s) => s.stepNumber))
    : 1;

  const initial: ManualFormInitial = {
    processCode: manual.processCode,
    productName: manual.productName ?? "",
    toollessToolCounts: parseJsonRecord(manual.toollessToolCounts),
    robotEnvironments: envs,
    notes: manual.notes ?? "",
    toollessToolColor: manual.toollessToolColor ?? "",
    workVideoUrl: manual.workVideoUrl ?? "",
    layoutPhotoUrl: manual.layoutPhotoUrl ?? "",
    wagonPhotoUrl: manual.wagonPhotoUrl ?? "",
    notesPhotoUrl: manual.notesPhotoUrl ?? "",
    stepCount,
    environmentBlocks: manual.environmentBlocks.map((b) => ({
      environment: b.environment as Environment,
      stepPhotos: (() => {
        try { const v = JSON.parse(b.stepPhotos); return v && typeof v === "object" ? v : {}; } catch { return {}; }
      })(),
      robotPrograms: b.programs.flatMap((p) =>
        parseJsonArray(p.robots).map((robot) => ({
          stepNumber: p.stepNumber,
          robot,
          number: p.number ?? "",
          name: p.name ?? "",
        })),
      ),
    })),
    jigProcessSteps: manual.jigProcessSteps.map((s) => ({
      stepNumber: s.stepNumber,
    })),
    aliases: manual.aliases.map((a) => a.processCode),
  };

  const master = findByProcessCode(manual.processCode);

  return (
    <ManualForm
      initial={initial}
      lockProcessCode
      stickyHeader={master && (master.itemName || master.processName) ? {
        itemName: master.itemName,
        processName: master.processName,
      } : undefined}
    />
  );
}
