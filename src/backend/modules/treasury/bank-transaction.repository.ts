import { prisma, prismaAsTxClient } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import { fromMinorUnits, toMinorUnits } from "@/shared/lib/money";
import type { BankTransactionEntry, CashFlowDirection } from "@/shared/types";
import type { BankTransaction as BankTransactionRow } from "@prisma/client";

import { toIsoDate } from "./treasury.dates";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `BankTransaction` RLS'e TABİDİR. Mutabakat FK'sı (`matchedEventId`) BU
 * tablodadır ve `@unique`tir — "bir tahmin en fazla BİR banka hareketiyle
 * eşleşir" kuralının SON savunma hattı servis katmanı değil, VERİTABANIDIR
 * (bkz. reconciliation.service.ts#confirm).
 */

function toEntry(row: BankTransactionRow): BankTransactionEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    valueDate: toIsoDate(row.valueDate),
    direction: row.direction,
    amount: fromMinorUnits(Number(row.amountMinor)),
    description: row.description,
    counterparty: row.counterparty,
    externalRef: row.externalRef,
    matchedEventId: row.matchedEventId,
    matchedAt: row.matchedAt?.toISOString() ?? null,
    matchedByUserId: row.matchedByUserId,
    treasuryImportBatchId: row.treasuryImportBatchId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface BankTransactionFilters {
  fromDate?: string;
  toDate?: string;
  onlyUnmatched?: boolean;
}

export const bankTransactionRepository = {
  async findMany(
    tenantId: string,
    filters: BankTransactionFilters = {},
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<BankTransactionEntry[]> {
    const rows = await client.bankTransaction.findMany({
      where: {
        tenantId,
        ...(filters.fromDate || filters.toDate
          ? {
              valueDate: {
                ...(filters.fromDate ? { gte: new Date(filters.fromDate) } : {}),
                ...(filters.toDate ? { lte: new Date(filters.toDate) } : {}),
              },
            }
          : {}),
        ...(filters.onlyUnmatched ? { matchedEventId: null } : {}),
      },
      orderBy: [{ valueDate: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toEntry);
  },

  async findById(
    tenantId: string,
    id: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<BankTransactionEntry | null> {
    const row = await client.bankTransaction.findUnique({ where: { id } });
    return row && row.tenantId === tenantId ? toEntry(row) : null;
  },

  /** Verilen referansların HANGİLERİ zaten kayıtlı — ekstre içe aktarımının
   * mükerrer satır tespiti için (bkz. bank-import.service.ts). */
  async findExistingRefs(
    tenantId: string,
    refs: string[],
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<Set<string>> {
    if (refs.length === 0) return new Set();
    const rows = await client.bankTransaction.findMany({
      where: { tenantId, externalRef: { in: refs } },
      select: { externalRef: true },
    });
    return new Set(
      rows.map((r) => r.externalRef).filter((r): r is string => r !== null),
    );
  },

  async create(
    tenantId: string,
    userId: string,
    input: {
      valueDate: string;
      direction: CashFlowDirection;
      amount: number;
      description: string;
      counterparty?: string;
      externalRef?: string;
    },
  ): Promise<BankTransactionEntry> {
    const row = await prisma.bankTransaction.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        valueDate: new Date(input.valueDate),
        direction: input.direction,
        amountMinor: BigInt(toMinorUnits(input.amount)),
        description: input.description,
        counterparty: input.counterparty ?? null,
        externalRef: input.externalRef ?? null,
        createdByUserId: userId,
      },
    });
    return toEntry(row);
  },

  async createManyFromImport(
    tenantId: string,
    userId: string,
    treasuryImportBatchId: string,
    rows: ValidBankImportRow[],
    client: PrismaClientOrTx,
  ): Promise<number> {
    const result = await client.bankTransaction.createMany({
      data: rows.map((r) => ({
        id: crypto.randomUUID(),
        tenantId,
        valueDate: new Date(r.valueDate),
        direction: r.direction,
        amountMinor: BigInt(toMinorUnits(r.amount)),
        description: r.description,
        counterparty: r.counterparty,
        externalRef: r.externalRef,
        treasuryImportBatchId,
        createdByUserId: userId,
      })),
      // Aynı ekstre iki kez yüklenirse `@@unique([tenantId, externalRef])`
      // ihlali PATLAMAK yerine SESSİZCE atlanır — önizlemede zaten
      // DUPLICATE_REF olarak işaretlenmiştir, bu son savunma hattıdır.
      skipDuplicates: true,
    });
    return result.count;
  },

  /** Mutabakat: hareketi bir tahmine bağlar. `client` ZORUNLU — her zaman
   * `withTenantTransaction` içinden, olayın durum değişikliğiyle AYNI
   * transaction'da çağrılır. */
  async attachMatch(
    tenantId: string,
    id: string,
    cashFlowEventId: string,
    userId: string,
    client: PrismaClientOrTx,
  ): Promise<void> {
    await client.bankTransaction.updateMany({
      where: { id, tenantId },
      data: {
        matchedEventId: cashFlowEventId,
        matchedAt: new Date(),
        matchedByUserId: userId,
      },
    });
  },

  async detachMatch(
    tenantId: string,
    id: string,
    client: PrismaClientOrTx,
  ): Promise<void> {
    await client.bankTransaction.updateMany({
      where: { id, tenantId },
      data: { matchedEventId: null, matchedAt: null, matchedByUserId: null },
    });
  },

  async findByTreasuryImportBatch(
    tenantId: string,
    treasuryImportBatchId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<BankTransactionEntry[]> {
    const rows = await client.bankTransaction.findMany({
      where: { tenantId, treasuryImportBatchId },
      orderBy: { valueDate: "asc" },
    });
    return rows.map(toEntry);
  },
};

/** `BankPreviewRow`'un commit için DARALTILMIŞ hali. */
export interface ValidBankImportRow {
  valueDate: string;
  direction: CashFlowDirection;
  amount: number;
  description: string;
  counterparty: string | null;
  externalRef: string | null;
}
