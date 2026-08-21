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
    treasuryImportBatchId: row.treasuryImportBatchId,
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

  /** THP içe aktarım sihirbazının commit adımı bunu çağırır (bkz.
   * treasury-import.service.ts) — GEÇERLİ (mappingConfigId + CASH katmanı +
   * çözümlenmiş vade + pozitif tutar) satırları topluca yazar. `client`
   * parametresi ZORUNLU geçirilir (her zaman bir `withTenantTransaction`
   * içinden çağrılır — senaryo kilidi kontrolüyle AYNI transaction). */
  async createManyFromImport(
    tenantId: string,
    userId: string,
    scenarioId: string,
    treasuryImportBatchId: string,
    rows: ValidThpImportRow[],
    client: PrismaClientOrTx,
  ): Promise<CashFlowEvent[]> {
    await client.cashFlowEvent.createMany({
      data: rows.map((r) => ({
        id: crypto.randomUUID(),
        tenantId,
        scenarioId,
        dueDate: new Date(r.dueDate),
        direction: r.direction,
        amountMinor: BigInt(toMinorUnits(r.amount)),
        categoryId: r.categoryId,
        counterparty: r.accountName,
        source: "THP_IMPORT",
        thpAccountCode: r.accountCode,
        mappingConfigId: r.mappingConfigId,
        treasuryImportBatchId,
        createdByUserId: userId,
      })),
    });
    return this.findByTreasuryImportBatch(tenantId, treasuryImportBatchId, client);
  },

  /** Mutabakat adaylarını çeker: SADECE `PLANNED` (nötrlenmiş/iptal olanlar
   * aday DEĞİLDİR) ve verilen tarih aralığındakiler. Aralık, banka
   * hareketlerinin valör aralığı + eşleşme penceresi kadar GENİŞLETİLMİŞ
   * olarak geçirilir (bkz. reconciliation.service.ts). */
  async findMatchCandidates(
    tenantId: string,
    scenarioId: string,
    fromDate: string,
    toDate: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<CashFlowEvent[]> {
    const rows = await client.cashFlowEvent.findMany({
      where: {
        tenantId,
        scenarioId,
        status: "PLANNED",
        dueDate: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
      orderBy: { dueDate: "asc" },
    });
    return rows.map(toCashFlowEvent);
  },

  /** Projeksiyon için: senaryonun TÜM `PLANNED` olayları (tarih sınırı
   * SERVİSTE uygulanır — vadesi geçmiş olanlar da ayrı kovaya girmek üzere
   * gereklidir, bkz. treasury-balance.service.ts). */
  async findPlanned(
    tenantId: string,
    scenarioId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<CashFlowEvent[]> {
    const rows = await client.cashFlowEvent.findMany({
      where: { tenantId, scenarioId, status: "PLANNED" },
      orderBy: { dueDate: "asc" },
    });
    return rows.map(toCashFlowEvent);
  },

  /** Durum geçişi (PLANNED <-> NEUTRALIZED). `expectedStatus` OPTİMİSTİK
   * KİLİTTİR: `updateMany` filtresine dahil edilir, böylece araya giren bir
   * başka istek durumu değiştirdiyse 0 satır güncellenir ve çağıran 409
   * atar — "önce oku sonra yaz" yarışı yapısal olarak kapanır. `client`
   * ZORUNLU (her zaman transaction içinden çağrılır). */
  async transitionStatus(
    tenantId: string,
    id: string,
    expectedStatus: CashFlowEventStatus,
    nextStatus: CashFlowEventStatus,
    client: PrismaClientOrTx,
  ): Promise<boolean> {
    const result = await client.cashFlowEvent.updateMany({
      where: { id, tenantId, status: expectedStatus },
      data: { status: nextStatus },
    });
    return result.count > 0;
  },

  /** "Deftere ekle" (promote): tahmin edilmemiş GERÇEK bir hareket için
   * doğrudan NEUTRALIZED bir olay yaratır — hareket eşleşmemiş kalıp
   * defterde delik bırakmasın diye (bkz. plan §3.4). */
  async createFromPromotion(
    tenantId: string,
    userId: string,
    input: {
      scenarioId: string;
      dueDate: string;
      direction: "INFLOW" | "OUTFLOW";
      amount: number;
      categoryId: string;
      counterparty: string | null;
      description: string | null;
    },
    client: PrismaClientOrTx,
  ): Promise<CashFlowEvent> {
    const row = await client.cashFlowEvent.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        scenarioId: input.scenarioId,
        dueDate: new Date(input.dueDate),
        direction: input.direction,
        amountMinor: BigInt(toMinorUnits(input.amount)),
        status: "NEUTRALIZED",
        categoryId: input.categoryId,
        counterparty: input.counterparty,
        description: input.description,
        createdByUserId: userId,
      },
    });
    return toCashFlowEvent(row);
  },

  async findByTreasuryImportBatch(
    tenantId: string,
    treasuryImportBatchId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<CashFlowEvent[]> {
    const rows = await client.cashFlowEvent.findMany({
      where: { tenantId, treasuryImportBatchId },
      orderBy: { dueDate: "asc" },
    });
    return rows.map(toCashFlowEvent);
  },
};

/** `ThpPreviewRow`'un commit için DARALTILMIŞ (tüm alanları dolu) hali —
 * `treasury-import.service.ts#commit` sadece bu şartları sağlayan satırları
 * filtreleyip geçirir. */
export interface ValidThpImportRow {
  accountCode: string;
  accountName: string | null;
  amount: number;
  dueDate: string;
  direction: "INFLOW" | "OUTFLOW";
  categoryId: string;
  mappingConfigId: string;
}
