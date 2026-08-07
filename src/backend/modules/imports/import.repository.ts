import { Prisma } from "@prisma/client";

import { prisma } from "@/backend/core/prisma-client";
import type {
  ImportBatch,
  ImportColumnMapping,
  ImportPreviewRow,
  ImportRowIssue,
} from "@/shared/types";
import type { ImportJob } from "@prisma/client";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `ImportJob` RLS'e TABİDİR (bkz. `prisma/schema.prisma`). Kolon
 * eşleştirmesi/önizleme dizileri (`detectedColumns`, `suggestedMapping`,
 * `appliedMapping`, `rows`, `issues`) düz `Json` kolonlarda saklanır —
 * TypeScript tarafında statik tip güvenliği bu sınırda (boundary) doğal
 * olarak kaybolur, aynı diğer Json alanlarda olduğu gibi.
 *
 * `rawGrid`, batch'in henüz eşleştirilmemiş HAM satırlarını tutar (nullable
 * Json) — kullanıcı kolon eşleştirmesini değiştirdiğinde (remap), dosyayı
 * yeniden yüklemeden bu ham veriyi yeni eşleştirmeyle tekrar çözümleyebilmek
 * için ayrı tutulur. commit sonrası `Prisma.JsonNull` ile temizlenir.
 */

interface RawGrid {
  headers: string[];
  rows: string[][];
}

function toImportBatch(row: ImportJob): ImportBatch {
  return {
    id: row.id,
    tenantId: row.tenantId,
    scenarioId: row.scenarioId,
    fileName: row.fileName,
    status: row.status,
    detectedColumns: row.detectedColumns as unknown as string[],
    suggestedMapping: row.suggestedMapping as unknown as ImportColumnMapping[],
    appliedMapping: row.appliedMapping as unknown as ImportColumnMapping[],
    rows: row.rows as unknown as ImportPreviewRow[],
    issues: row.issues as unknown as ImportRowIssue[],
    createdAt: row.createdAt.toISOString(),
    createdByUserId: row.createdByUserId,
    createdByUserName: row.createdByUserName,
    committedAt: row.committedAt ? row.committedAt.toISOString() : null,
  };
}

function toJsonInput(batch: ImportBatch) {
  return {
    tenantId: batch.tenantId,
    scenarioId: batch.scenarioId,
    fileName: batch.fileName,
    status: batch.status,
    detectedColumns: batch.detectedColumns as Prisma.InputJsonValue,
    suggestedMapping: batch.suggestedMapping as unknown as Prisma.InputJsonValue,
    appliedMapping: batch.appliedMapping as unknown as Prisma.InputJsonValue,
    rows: batch.rows as unknown as Prisma.InputJsonValue,
    issues: batch.issues as unknown as Prisma.InputJsonValue,
    createdAt: new Date(batch.createdAt),
    createdByUserId: batch.createdByUserId,
    createdByUserName: batch.createdByUserName,
    committedAt: batch.committedAt ? new Date(batch.committedAt) : null,
  };
}

export const importRepository = {
  async save(batch: ImportBatch): Promise<void> {
    const data = toJsonInput(batch);
    await prisma.importJob.upsert({
      where: { id: batch.id },
      create: { id: batch.id, ...data },
      update: data,
    });
  },

  async findById(id: string): Promise<ImportBatch | null> {
    const row = await prisma.importJob.findUnique({ where: { id } });
    return row ? toImportBatch(row) : null;
  },

  async saveRawGrid(id: string, grid: RawGrid): Promise<void> {
    await prisma.importJob.update({
      where: { id },
      data: { rawGrid: grid as unknown as Prisma.InputJsonValue },
    });
  },

  async findRawGrid(id: string): Promise<RawGrid | null> {
    const row = await prisma.importJob.findUnique({
      where: { id },
      select: { rawGrid: true },
    });
    return (row?.rawGrid as RawGrid | null | undefined) ?? null;
  },

  async deleteRawGrid(id: string): Promise<void> {
    // `updateMany` KASITLI: kayıt yoksa (olması beklenmez) sessizce no-op —
    // diğer repository'lerdeki aynı disiplin (bkz. session.repository.ts).
    await prisma.importJob.updateMany({
      where: { id },
      data: { rawGrid: Prisma.JsonNull },
    });
  },
};
