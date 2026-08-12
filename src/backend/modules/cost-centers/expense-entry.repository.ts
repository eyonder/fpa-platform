import { prisma, prismaAsTxClient } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import { fromMinorUnits, toMinorUnits } from "@/shared/lib/money";
import type { ExpenseEntry, ExpenseEntryStatus } from "@/shared/types";
import type { ExpenseEntry as ExpenseEntryRow } from "@prisma/client";

import type { CreateExpenseEntryInput } from "./expense-entry.schema";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `ExpenseEntry` RLS'e TABİDİR. DB'de tutar `amountMinor` (kuruş, `BigInt`)
 * olarak saklanır — bu sınırda (boundary) `shared/lib/money.ts`teki
 * `toMinorUnits`/`fromMinorUnits` ile domain tipinin (`ExpenseEntry.amount`,
 * majör birim `number`) karşılığına çevrilir (bkz. budget-line.repository.ts
 * ile aynı disiplin).
 */

function toExpenseEntry(row: ExpenseEntryRow): ExpenseEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    scenarioId: row.scenarioId,
    costCenterId: row.costCenterId,
    categoryId: row.categoryId,
    month: row.month,
    amount: fromMinorUnits(Number(row.amountMinor)),
    status: row.status,
    submittedByUserName: row.submittedByUserName,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    decidedByUserName: row.decidedByUserName,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    rejectionReason: row.rejectionReason,
    committedAt: row.committedAt ? row.committedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const expenseEntryRepository = {
  async findById(
    tenantId: string,
    id: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<ExpenseEntry | null> {
    const row = await client.expenseEntry.findUnique({ where: { id } });
    return row && row.tenantId === tenantId ? toExpenseEntry(row) : null;
  },

  async findByCombo(
    tenantId: string,
    scenarioId: string,
    costCenterId: string,
    categoryId: string,
    month: number,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<ExpenseEntry | null> {
    const row = await client.expenseEntry.findUnique({
      where: {
        tenantId_scenarioId_costCenterId_categoryId_month: {
          tenantId,
          scenarioId,
          costCenterId,
          categoryId,
          month,
        },
      },
    });
    return row ? toExpenseEntry(row) : null;
  },

  async findByScenario(
    tenantId: string,
    scenarioId: string,
    filters: { costCenterId?: string; status?: ExpenseEntryStatus },
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<ExpenseEntry[]> {
    const rows = await client.expenseEntry.findMany({
      where: {
        tenantId,
        scenarioId,
        ...(filters.costCenterId ? { costCenterId: filters.costCenterId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: [{ month: "asc" }, { costCenterId: "asc" }],
    });
    return rows.map(toExpenseEntry);
  },

  async findApprovedByScenario(
    tenantId: string,
    scenarioId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<ExpenseEntry[]> {
    return this.findByScenario(tenantId, scenarioId, { status: "APPROVED" }, client);
  },

  async create(
    tenantId: string,
    input: CreateExpenseEntryInput,
  ): Promise<ExpenseEntry> {
    const now = new Date();
    const row = await prisma.expenseEntry.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        scenarioId: input.scenarioId,
        costCenterId: input.costCenterId,
        categoryId: input.categoryId,
        month: input.month,
        amountMinor: BigInt(toMinorUnits(input.amount)),
        status: "DRAFT",
        createdAt: now,
      },
    });
    return toExpenseEntry(row);
  },

  async updateAmount(
    tenantId: string,
    id: string,
    amount: number,
  ): Promise<ExpenseEntry | null> {
    // `updateMany` KASITLI: yanlış tenant'a ait bir id verilirse (RLS zaten
    // engeller, burası ikinci savunma hattı) sessizce 0 satır güncellenir —
    // diğer repository'lerdeki aynı disiplin (bkz. scenario.repository.ts).
    const result = await prisma.expenseEntry.updateMany({
      where: { id, tenantId },
      data: { amountMinor: BigInt(toMinorUnits(amount)) },
    });
    if (result.count === 0) return null;
    return this.findById(tenantId, id);
  },

  async transitionToSubmitted(
    tenantId: string,
    id: string,
    userId: string,
    userName: string,
  ): Promise<ExpenseEntry | null> {
    const result = await prisma.expenseEntry.updateMany({
      where: { id, tenantId },
      data: {
        status: "SUBMITTED",
        submittedByUserId: userId,
        submittedByUserName: userName,
        submittedAt: new Date(),
        // Yeniden gönderimde önceki red gerekçesi/karar temizlenir.
        decidedByUserId: null,
        decidedByUserName: null,
        decidedAt: null,
        rejectionReason: null,
      },
    });
    if (result.count === 0) return null;
    return this.findById(tenantId, id);
  },

  async transitionToApproved(
    tenantId: string,
    id: string,
    userId: string,
    userName: string,
  ): Promise<ExpenseEntry | null> {
    const result = await prisma.expenseEntry.updateMany({
      where: { id, tenantId },
      data: {
        status: "APPROVED",
        decidedByUserId: userId,
        decidedByUserName: userName,
        decidedAt: new Date(),
      },
    });
    if (result.count === 0) return null;
    return this.findById(tenantId, id);
  },

  async transitionToRejected(
    tenantId: string,
    id: string,
    userId: string,
    userName: string,
    reason: string,
  ): Promise<ExpenseEntry | null> {
    const result = await prisma.expenseEntry.updateMany({
      where: { id, tenantId },
      data: {
        status: "REJECTED",
        decidedByUserId: userId,
        decidedByUserName: userName,
        decidedAt: new Date(),
        rejectionReason: reason,
      },
    });
    if (result.count === 0) return null;
    return this.findById(tenantId, id);
  },

  /** APPROVED -> COMMITTED, `expense-entry.service.ts#commitApproved`'in bulkUpsert'ten
   * SONRAKİ ikinci adımı (bkz. import.service.ts#commit ile aynı iki-adımlı sıralama). */
  async markCommitted(
    tenantId: string,
    ids: string[],
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<void> {
    await client.expenseEntry.updateMany({
      where: { id: { in: ids }, tenantId },
      data: { status: "COMMITTED", committedAt: new Date() },
    });
  },
};
