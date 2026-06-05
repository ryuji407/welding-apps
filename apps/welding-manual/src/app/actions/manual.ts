"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ENVIRONMENTS, ROBOTS } from "@/lib/manual";

const envEnum = z.enum(ENVIRONMENTS);

const robotProgramSchema = z.object({
  stepNumber: z.number().int().min(1).max(99),
  robot: z.enum(ROBOTS),
  number: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});

const envBlockSchema = z.object({
  environment: envEnum,
  robotPrograms: z.array(robotProgramSchema),
  stepPhotos: z.record(z.string(), z.string()).optional().default({}),
});

const jigStepSchema = z.object({
  stepNumber: z.number().int().min(1).max(99),
});

const manualSchema = z.object({
  processCode: z.string().min(1).max(64),
  productName: z.string().optional().nullable(),
  toollessToolCounts: z.record(z.string(), z.number().int().min(0)).default({}),
  robotEnvironments: z.array(envEnum),
  notes: z.string().optional().nullable(),
  toollessToolColor: z.string().optional().nullable(),
  workVideoUrl: z.string().optional().nullable(),
  layoutPhotoUrl: z.string().optional().nullable(),
  wagonPhotoUrl: z.string().optional().nullable(),
  notesPhotoUrl: z.string().optional().nullable(),
  environmentBlocks: z.array(envBlockSchema),
  jigProcessSteps: z.array(jigStepSchema),
  aliases: z.array(z.string().min(1).max(64)).optional().default([]),
});

export type ManualInput = z.infer<typeof manualSchema>;

export async function saveManual(input: ManualInput) {
  const data = manualSchema.parse(input);

  const baseData = {
    productName: data.productName ?? null,
    toollessToolCounts: JSON.stringify(data.toollessToolCounts ?? {}),
    robotEnvironments: JSON.stringify(data.robotEnvironments),
    notes: data.notes ?? null,
    toollessToolColor: data.toollessToolColor ?? null,
    workVideoUrl: data.workVideoUrl ?? null,
    layoutPhotoUrl: data.layoutPhotoUrl ?? null,
    wagonPhotoUrl: data.wagonPhotoUrl ?? null,
    notesPhotoUrl: data.notesPhotoUrl ?? null,
  };

  const manual = await prisma.manual.upsert({
    where: { processCode: data.processCode },
    update: baseData,
    create: { processCode: data.processCode, ...baseData },
  });

  // 環境ブロック・プログラムは完全置換
  await prisma.environmentBlock.deleteMany({ where: { manualId: manual.id } });
  for (const block of data.environmentBlocks) {
    await prisma.environmentBlock.create({
      data: {
        manualId: manual.id,
        environment: block.environment,
        stepPhotos: JSON.stringify(block.stepPhotos ?? {}),
        programs: {
          create: block.robotPrograms.map((rp, i) => ({
            programNumber: i + 1,
            stepNumber: rp.stepNumber,
            robots: JSON.stringify([rp.robot]),
            number: rp.number ?? null,
            name: rp.name ?? null,
            photoUrl: rp.photoUrl ?? null,
          })),
        },
      },
    });
  }

  // 治具工程は画像保持のため差分更新
  const existingSteps = await prisma.jigProcessStep.findMany({
    where: { manualId: manual.id },
    select: { id: true, stepNumber: true },
  });
  const wantedNumbers = new Set(data.jigProcessSteps.map((s) => s.stepNumber));
  const existingNumbers = new Set(existingSteps.map((s) => s.stepNumber));

  const toDelete = existingSteps
    .filter((s) => !wantedNumbers.has(s.stepNumber))
    .map((s) => s.id);
  if (toDelete.length > 0) {
    await prisma.jigProcessStep.deleteMany({ where: { id: { in: toDelete } } });
  }
  for (const step of data.jigProcessSteps) {
    if (!existingNumbers.has(step.stepNumber)) {
      await prisma.jigProcessStep.create({
        data: { manualId: manual.id, stepNumber: step.stepNumber },
      });
    }
  }

  // エイリアスの同期（不要なものを削除し、新規追加）
  await prisma.processCodeAlias.deleteMany({
    where: { manualId: manual.id, processCode: { notIn: data.aliases } },
  });
  for (const code of data.aliases) {
    await prisma.processCodeAlias.upsert({
      where: { processCode: code },
      update: { manualId: manual.id },
      create: { processCode: code, manualId: manual.id },
    });
  }

  revalidatePath("/");
  revalidatePath(`/manual/${data.processCode}`);
}

export async function saveManualAndRedirect(input: ManualInput) {
  await saveManual(input);
  redirect(`/manual/${input.processCode}`);
}

export async function deleteManual(processCode: string) {
  await prisma.manual.delete({ where: { processCode } });
  revalidatePath("/");
  redirect("/");
}
