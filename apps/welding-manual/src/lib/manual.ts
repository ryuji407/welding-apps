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

// 新規作成画面で「登録済み」表示・作業名検索のための工程コード一覧＋作業名(productName)マップ（本体 + エイリアス）
export async function getManualRegistryInfo(): Promise<{
  registeredCodes: string[];
  nameMap: Record<string, string>;
}> {
  const manuals = await prisma.manual.findMany({
    select: { processCode: true, productName: true, aliases: { select: { processCode: true } } },
  });
  const registeredCodes: string[] = [];
  const nameMap: Record<string, string> = {};
  for (const m of manuals) {
    registeredCodes.push(m.processCode);
    for (const a of m.aliases) registeredCodes.push(a.processCode);
    if (m.productName) {
      nameMap[m.processCode] = m.productName;
      for (const a of m.aliases) nameMap[a.processCode] = m.productName;
    }
  }
  return { registeredCodes, nameMap };
}

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
