import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseJsonArray } from "@/lib/manual";
import { parseJsonRecord } from "@/lib/constants";

export async function GET() {
  const manuals = await prisma.manual.findMany({
    include: {
      environmentBlocks: {
        include: { programs: { orderBy: { programNumber: "asc" } } },
      },
      jigProcessSteps: {
        include: { images: true },
        orderBy: { stepNumber: "asc" },
      },
      mediaFiles: true,
    },
    orderBy: { processCode: "asc" },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    count: manuals.length,
    manuals: manuals.map((m) => ({
      processCode: m.processCode,
      productName: m.productName,
      toollessToolCounts: parseJsonRecord(m.toollessToolCounts),
      robotEnvironments: parseJsonArray(m.robotEnvironments),
      notes: m.notes,
      toollessToolColor: m.toollessToolColor,
      workVideoUrl: m.workVideoUrl,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      environmentBlocks: m.environmentBlocks.map((b) => ({
        environment: b.environment,
        programs: b.programs.map((p) => ({
          programNumber: p.programNumber,
          robots: parseJsonArray(p.robots),
          number: p.number,
          name: p.name,
        })),
      })),
      jigProcessSteps: m.jigProcessSteps.map((s) => ({
        stepNumber: s.stepNumber,
        images: s.images.map((i) => ({ url: i.url, filename: i.filename })),
      })),
      layoutImages: m.mediaFiles
        .filter((f) => f.kind === "layout")
        .map((f) => ({ url: f.url, filename: f.filename })),
      wagonImages: m.mediaFiles
        .filter((f) => f.kind === "wagon")
        .map((f) => ({ url: f.url, filename: f.filename })),
    })),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="manuals-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
