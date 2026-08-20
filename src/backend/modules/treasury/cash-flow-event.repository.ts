import { prisma, prismaAsTxClient } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import { fromMinorUnits, toMinorUnits } from "@/shared/lib/money";
import type { CashFlowEvent, CashFlowEventStatus } from "@/shared/types";
import type { CashFlowEvent as CashFlowEventRow } from "@prisma/client";

import type {
  CreateCashFlowEventInput,
  UpdateCashFlowEventInput,
} from "./treasury.schema";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `CashFlowEvent` RLS'e TABİDİR. DB'de tutar `amountMinor` (kuruş, `BigInt`)
 * olarak saklanır — `shared/lib/money.ts`teki `toMinorUnits`/`fromMinorUnits`
 * ile bu sınırda çevrilir (bkz. sales-opportunity.repository.ts ile aynı
 * disiplin). `dueDate` gün hassasiyetlidir (`@db.Date`).
 *
 * Faz 4.1 kapsamı: minimal CRUD. THP provenance alanları (`thpAccountCode`,
 * `mappingConfigId`) ve tahakkuk katmanı alanları modelde VAR ama bu fazda
 * SADECE geçirilip saklanır — Faz 4.2/4.4'e kadar iş mantığı yok.
 */

function toCashFlowEvent(row: CashFlowEventRow): CashFlowEvent {
  return {
    id: row.id,
    tenantId: row.tenantId,
    scenarioId: row.scenarioId,
    dueDate: row.dueDate.toISOString().slice(0, 10),
    direction: row.direction,
    amount: fromMinorUnits(Number(row.amountMinor)),
    status: row.status,
    source: row.source,
    accrualScenarioId: row.accrualScenarioId,
    accrualStartMonth: row.accrualStartMonth,
    accrualSpreadMonths: row.accrualSpreadMonths,
    categoryId: row.categoryId,
    counterparty: row.counterparty,
    description: row.description,
    thpAccountCode: row.thpAccountCode,
    mappingConfigId: row.mappingConfigId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const cashFlowEventRepository = {
  async findByScenario(
    tenantId: string,
    scenarioId: string,
    filters: { status?: CashFlowEventStatus } = {},
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<CashFlowEvent[]> {
    const rows = await client.cashFlowEvent.findMany({
      where: {
        tenantId,
        scenarioId,
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { dueDate: "asc" },
    });
    return rows.map(toCashFlowEvent);
  },

  async findById(
    tenantId: string,
    id: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<CashFlowEvent | null> {
    const row = await client.cashFlowEvent.findUnique({ where: { id } });
    return row && row.tenantId === tenantId ? toCashFlowEvent(row) : null;
  },

  async create(
    tenantId: string,
    userId: string,
    input: CreateCashFlowEventInput,
  ): Promise<CashFlowEvent> {
    const row = await prisma.cashFlowEvent.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        scenarioId: input.scenarioId,
        dueDate: new Date(input.dueDate),
        direction: input.direction,
        amountMinor: BigInt(toMinorUnits(input.amount)),
        categoryId: input.categoryId,
        counterparty: input.counterparty ?? null,
        description: input.description ?? null,
        accrualScenarioId: input.accrualScenarioId ?? null,
        accrualStartMonth: input.accrualStartMonth ?? null,
        accrualSpreadMonths: input.accrualSpreadMonths ?? 1,
        createdByUserId: userId,
      },
    });
    return toCashFlowEvent(row);
  },

  async update(
    tenantId: string,
    id: string,
    input: UpdateCashFlowEventInput,
  ): Promise<CashFlowEvent | null> {
    // `updateMany` KASITLI: yanlış tenant'a ait bir id verilirse (RLS zaten
    // engeller, burası ikinci savunma hattı) sessizce 0 satır güncellenir —
    // diğer repository'lerdeki aynı disiplin (bkz. sales-opportunity.repository.ts).
    const result = await prisma.cashFlowEvent.updateMany({
      where: { id, tenantId },
      data: {
        ...(input.dueDate !== undefined ? { dueDate: new Date(input.dueDate) } : {}),
        ...(input.direction !== undefined ? { direction: input.direction } : {}),
        ...(input.amount !== undefined
          ? { amountMinor: BigInt(toMinorUnits(input.amount)) }
          : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.counterparty !== undefined
          ? { counterparty: input.counterparty }
          : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.accrualScenarioId !== undefined
          ? { accrualScenarioId: input.accrualScenarioId }
          : {}),
        ...(input.accrualStartMonth !== undefined
          ? { accrualStartMonth: input.accrualStartMonth }
          : {}),
        ...(input.accrualSpreadMonths !== undefined
          ? { accrualSpreadMonths: input.accrualSpreadMonths }
          : {}),
      },
    });
    if (result.count === 0) return null;
    return this.findById(tenantId, id);
  },

  /** Gerçek DELETE — `CashFlowEvent`'in `ExpenseEntry`/`SalesOpportunity` gibi
   * bir onay akışı YOK (bkz. dosya başı notu), bu yüzden "iptal et" durumu
   * (CANCELLED) ile karıştırılmaz: kullanıcı ya durumu CANCELLED'a çeker
   * (update) ya da kaydı tamamen siler (bu metod). */
  async delete(tenantId: string, id: string): Promise<boolean> {
    const result = await prisma.cashFlowEvent.deleteMany({ where: { id, tenantId } });
    return result.count > 0;
  },
};
