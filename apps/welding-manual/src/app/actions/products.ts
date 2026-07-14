"use server";

// 製品情報のデータ層（旧 Firebase Firestore を SQLite(Prisma) に移行）。
// クライアントの hooks から呼び出す。戻り値はすべてシリアライズ可能なプレーンオブジェクト。

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { unlinkUploadedFile } from "@/lib/uploads";
import type {
  Product,
  ProductFormData,
  ProductDefect,
} from "@/features/products/types/product";
import type {
  ProductTemplate,
  ProductTemplateFormData,
} from "@/features/products/types/template";

/* ───────── シリアライズ ヘルパ ───────── */

function parse<T>(json: string, fallback: T): T {
  try {
    const v = JSON.parse(json);
    return v == null ? fallback : (v as T);
  } catch {
    return fallback;
  }
}

type ProductRow = Awaited<ReturnType<typeof prisma.product.findFirst>>;
function toProduct(row: NonNullable<ProductRow>): Product {
  const instances = parse<{ instanceId: string; templateId: string }[]>(row.appliedTemplateInstances, []);
  return {
    id: row.id,
    name: row.name,
    processCodes: parse<string[]>(row.processCodes, []),
    processingNotes: row.processingNotes,
    photoUrls: parse<string[]>(row.photoUrls, []),
    specifications: parse(row.specifications, []),
    appliedTemplateInstances: instances,
    appliedTemplateIds: instances.map((i) => i.templateId),
    templateValues: parse(row.templateValues, []),
    isActive: row.isActive,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

type TemplateRow = Awaited<ReturnType<typeof prisma.productTemplate.findFirst>>;
function toTemplate(row: NonNullable<TemplateRow>): ProductTemplate {
  return {
    id: row.id,
    name: row.name,
    fields: parse(row.fields, []),
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

type DefectRow = Awaited<ReturnType<typeof prisma.productDefect.findFirst>>;
function toDefect(row: NonNullable<DefectRow>): ProductDefect {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    occurredAt: row.occurredAt.getTime(),
    reportedBy: row.reportedBy,
    description: row.description,
    photoUrls: parse<string[]>(row.photoUrls, []),
    createdAt: row.createdAt.getTime(),
  };
}

/* ───────── 製品 読取 ───────── */

export async function listProductsAction(): Promise<Product[]> {
  const rows = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  return rows.filter((r) => r.isActive !== false).map(toProduct);
}

export async function getProductAction(id: string): Promise<Product | null> {
  if (!id) return null;
  const row = await prisma.product.findUnique({ where: { id } });
  return row && row.isActive !== false ? toProduct(row) : null;
}

export async function getProductByProcessCodeAction(processCode: string): Promise<Product | null> {
  if (!processCode) return null;
  // processCodes は JSON 文字列。まず contains で候補を絞り JS で厳密一致を確認。
  const candidates = await prisma.product.findMany({
    where: { processCodes: { contains: JSON.stringify(processCode) } },
  });
  const hit = candidates.find(
    (r) => r.isActive !== false && parse<string[]>(r.processCodes, []).includes(processCode),
  );
  return hit ? toProduct(hit) : null;
}

/* ───────── 製品 書込 ───────── */

export async function createProductAction(
  data: ProductFormData,
  photoUrls: string[],
): Promise<string> {
  const id = randomUUID();
  const instances = data.appliedTemplateInstances
    ?? (data.appliedTemplateIds ?? []).map((tid) => ({ instanceId: `legacy-${tid}`, templateId: tid }));
  await prisma.product.create({
    data: {
      id,
      name: data.name,
      processCodes: JSON.stringify(data.processCodes ?? []),
      processingNotes: data.processingNotes ?? "",
      photoUrls: JSON.stringify(photoUrls ?? []),
      specifications: JSON.stringify(data.specifications ?? []),
      appliedTemplateInstances: JSON.stringify(instances),
      templateValues: JSON.stringify(data.templateValues ?? []),
      isActive: true,
    },
  });
  return id;
}

// 配列/オブジェクト型フィールドは JSON 文字列化して更新する。
type ProductPatch = Partial<
  Pick<Product, "name" | "processingNotes" | "isActive"> & {
    processCodes: string[];
    photoUrls: string[];
    specifications: Product["specifications"];
    appliedTemplateInstances: Product["appliedTemplateInstances"];
    templateValues: Product["templateValues"];
  }
>;

export async function updateProductAction(id: string, patch: ProductPatch): Promise<void> {
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.processingNotes !== undefined) data.processingNotes = patch.processingNotes;
  if (patch.isActive !== undefined) data.isActive = patch.isActive;
  if (patch.processCodes !== undefined) data.processCodes = JSON.stringify(patch.processCodes);
  if (patch.photoUrls !== undefined) data.photoUrls = JSON.stringify(patch.photoUrls);
  if (patch.specifications !== undefined) data.specifications = JSON.stringify(patch.specifications);
  if (patch.appliedTemplateInstances !== undefined)
    data.appliedTemplateInstances = JSON.stringify(patch.appliedTemplateInstances);
  if (patch.templateValues !== undefined) data.templateValues = JSON.stringify(patch.templateValues);
  await prisma.product.update({ where: { id }, data });
}

/* ───────── 欠陥 ───────── */

export async function listDefectsAction(productId: string): Promise<ProductDefect[]> {
  const rows = await prisma.productDefect.findMany({ where: { productId } });
  return rows.map(toDefect).sort((a, b) => b.occurredAt - a.occurredAt);
}

export async function addDefectAction(
  productId: string,
  productName: string,
  occurredAt: string,
  reportedBy: string,
  description: string,
  photoUrls: string[],
): Promise<void> {
  await prisma.productDefect.create({
    data: {
      id: randomUUID(),
      productId,
      productName,
      occurredAt: new Date(occurredAt),
      reportedBy,
      description,
      photoUrls: JSON.stringify(photoUrls ?? []),
    },
  });
}

/* ───────── テンプレート ───────── */

export async function listTemplatesAction(): Promise<ProductTemplate[]> {
  const rows = await prisma.productTemplate.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toTemplate);
}

export async function createTemplateAction(data: ProductTemplateFormData): Promise<string> {
  const id = randomUUID();
  await prisma.productTemplate.create({
    data: { id, name: data.name, fields: JSON.stringify(data.fields ?? []) },
  });
  return id;
}

export async function updateTemplateAction(id: string, data: ProductTemplateFormData): Promise<void> {
  await prisma.productTemplate.update({
    where: { id },
    data: { name: data.name, fields: JSON.stringify(data.fields ?? []) },
  });
}

export async function deleteTemplateAction(id: string): Promise<void> {
  await prisma.productTemplate.delete({ where: { id } });
}

/* ───────── 製品ノート ───────── */

type ProductNoteRow = Awaited<ReturnType<typeof prisma.productNote.findFirst>>;
function toNote(row: NonNullable<ProductNoteRow>) {
  return {
    id: row.id,
    componentOfficialName: row.componentOfficialName,
    warnings: parse(row.warnings, []),
    instructionSteps: parse(row.instructionSteps, []),
    notes: row.notes ?? "",
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function listProductNotesAction() {
  const rows = await prisma.productNote.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toNote);
}

export async function createProductNoteAction(componentOfficialName: string): Promise<string> {
  const id = encodeURIComponent(componentOfficialName);
  await prisma.productNote.upsert({
    where: { id },
    update: {},
    create: { id, componentOfficialName, warnings: "[]", instructionSteps: "[]", notes: "" },
  });
  return id;
}

type NotePatch = { warnings?: unknown; instructionSteps?: unknown; notes?: string };
export async function updateProductNoteAction(id: string, patch: NotePatch): Promise<void> {
  const data: Record<string, unknown> = {};
  if (patch.warnings !== undefined) data.warnings = JSON.stringify(patch.warnings);
  if (patch.instructionSteps !== undefined) data.instructionSteps = JSON.stringify(patch.instructionSteps);
  if (patch.notes !== undefined) data.notes = patch.notes;
  await prisma.productNote.update({ where: { id }, data });
}

// 未使用になった写真ファイルの後始末（呼び出し側の任意利用）
export async function deleteProductFileAction(url: string): Promise<void> {
  await unlinkUploadedFile(url);
}
