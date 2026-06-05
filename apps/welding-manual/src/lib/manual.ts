import "server-only";
import { prisma } from "./db";

export { ENVIRONMENTS, ROBOTS, parseJsonArray } from "./constants";
export type { Environment, Robot } from "./constants";

const manualInclude = {
  environmentBlocks: {
    include: { programs: { orderBy: [{ stepNumber: "asc" as const }, { programNumber: "asc" as const }] } },
  },
  jigProcessSteps: {
    include: { images: true },
    orderBy: { stepNumber: "asc" as const },
  },
  mediaFiles: true,
  aliases: { select: { processCode: true } },
};

export async function getManualByCode(processCode: string) {
  const direct = await prisma.manual.findUnique({
    where: { processCode },
    include: manualInclude,
  });
  if (direct) return direct;

  const alias = await prisma.processCodeAlias.findUnique({
    where: { processCode },
    include: { manual: { include: manualInclude } },
  });
  return alias?.manual ?? null;
}

export type ManualWithRelations = NonNullable<
  Awaited<ReturnType<typeof getManualByCode>>
>;

export async function listManuals(search?: string) {
  return prisma.manual.findMany({
    where: search
      ? {
          OR: [
            { processCode: { contains: search } },
            { productName: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      processCode: true,
      productName: true,
      updatedAt: true,
    },
  });
}
