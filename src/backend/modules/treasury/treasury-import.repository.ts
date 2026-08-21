import { Prisma } from "@prisma/client";

import { prisma, prismaAsTxClient } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import type {
  BankColumnMapping,
  ThpColumnMapping,
  TreasuryImportKind,
  TreasuryImportStatus,
} from "@/shared/types";
import type { TreasuryImportBatch as TreasuryImportBatchRow } from "@prisma/client";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `TreasuryImportBatch` RLS'e TABİDİR. `import.repository.ts`teki AYNI
 * `rawGrid` saklama deseni — ANCAK `ImportJob`'un AKSİNE çözümlenmiş önizleme
 * satırları/sorunları (rows/issues) BURADA SAKLANMAZ, sadece ÖZET sayaçlar
 * (rowCount/mappedCount/skippedCount) ve uygulanan kolon eşleştirmesi
 * (appliedMapping). Tam önizleme HER ZAMAN `treasury-import.service.ts`te
 * rawGrid + appliedMapping + O ANKİ MappingConfig kurallarından yeniden
 * hesaplanır (bkz. prisma/schema.prisma'daki TreasuryImportBatch yorumu).
 *
 * Bu dosya SADECE DB'ye yansıyan alanları taşır (`TreasuryImportBatchRecord`)
 * — tam API yanıtı (rows/issues dahil) servis katmanında birleştirilir.
 *
 * `appliedMapping` GENERIC'tir (`M`): AYNI tablo iki farklı sihirbaz
 * tarafından paylaşılır (`kind = THP` / `kind = BANK_STATEMENT`) ve her
 * birinin kolon eşleştirme şekli farklıdır. Varsayılan `ThpColumnMapping[]`
 * — böylece Faz 4.2'de yazılan çağrı yerleri DEĞİŞMEDEN derlenir; banka
 * tarafı `BankColumnMapping[]` geçirir. DB'de her ikisi de aynı `Json`
 * kolonudur, ayrım `kind` ile yapılır.
 */

/** Bu tabloda saklanabilecek kolon eşleştirme şekilleri. */
export type StoredColumnMapping = ThpColumnMapping[] | BankColumnMapping[];

export interface RawGrid {
  headers: string[];
  rows: string[][];
}

export interface TreasuryImportBatchRecord<
  M extends StoredColumnMapping = ThpColumnMapping[],
> {
  id: string;
  tenantId: string;
  scenarioId: string;
  fileName: string;
  status: TreasuryImportStatus;
  kind: TreasuryImportKind;
  appliedMapping: M | null;
  rowCount: number;
  mappedCount: number;
  skippedCount: number;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toRecord<M extends StoredColumnMapping = ThpColumnMapping[]>(
  row: TreasuryImportBatchRow,
): TreasuryImportBatchRecord<M> {
  return {
    id: row.id,
    tenantId: row.tenantId,
    scenarioId: row.scenarioId,
    fileName: row.fileName,
    status: row.status,
    kind: row.kind,
    appliedMapping: row.appliedMapping as unknown as M | null,
    rowCount: row.rowCount,
    mappedCount: row.mappedCount,
    skippedCount: row.skippedCount,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const treasuryImportRepository = {
  async findById<M extends StoredColumnMapping = ThpColumnMapping[]>(
    tenantId: string,
    id: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<TreasuryImportBatchRecord<M> | null> {
    const row = await client.treasuryImportBatch.findUnique({ where: { id } });
    return row && row.tenantId === tenantId ? toRecord<M>(row) : null;
  },

  async create(
    tenantId: string,
    userId: string,
    scenarioId: string,
    fileName: string,
    kind: TreasuryImportKind = "THP",
  ): Promise<TreasuryImportBatchRecord<StoredColumnMapping>> {
    const row = await prisma.treasuryImportBatch.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        scenarioId,
        fileName,
        kind,
        createdByUserId: userId,
      },
    });
    return toRecord<StoredColumnMapping>(row);
  },

  async saveRawGrid(id: string, grid: RawGrid): Promise<void> {
    await prisma.treasuryImportBatch.update({
      where: { id },
      data: { rawGrid: grid as unknown as Prisma.InputJsonValue },
    });
  },

  async findRawGrid(id: string): Promise<RawGrid | null> {
    const row = await prisma.treasuryImportBatch.findUnique({
      where: { id },
      select: { rawGrid: true },
    });
    return (row?.rawGrid as RawGrid | null | undefined) ?? null;
  },

  async updateMapping<M extends StoredColumnMapping = ThpColumnMapping[]>(
    id: string,
    mapping: M,
    counts: { rowCount: number; mappedCount: number; skippedCount: number },
  ): Promise<TreasuryImportBatchRecord<M>> {
    const row = await prisma.treasuryImportBatch.update({
      where: { id },
      data: {
        appliedMapping: mapping as unknown as Prisma.InputJsonValue,
        rowCount: counts.rowCount,
        mappedCount: counts.mappedCount,
        skippedCount: counts.skippedCount,
      },
    });
    return toRecord<M>(row);
  },

  async markCommitted<M extends StoredColumnMapping = ThpColumnMapping[]>(
    id: string,
  ): Promise<TreasuryImportBatchRecord<M>> {
    const row = await prisma.treasuryImportBatch.update({
      where: { id },
      data: { status: "COMMITTED", rawGrid: Prisma.JsonNull },
    });
    return toRecord<M>(row);
  },
};
