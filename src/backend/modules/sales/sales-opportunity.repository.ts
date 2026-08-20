import { prisma, prismaAsTxClient } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import { fromMinorUnits, toMinorUnits } from "@/shared/lib/money";
import { OPEN_SALES_STAGES } from "@/shared/types";
import type { SalesOpportunity, SalesOpportunityStage } from "@/shared/types";
import type { SalesOpportunity as SalesOpportunityRow } from "@prisma/client";

import type {
  CreateSalesOpportunityInput,
  UpdateSalesOpportunityInput,
} from "./sales.schema";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `SalesOpportunity` RLS'e TABİDİR. DB'de tutar `expectedValueMinor` (kuruş,
 * `BigInt`) olarak saklanır — `shared/lib/money.ts`teki
 * `toMinorUnits`/`fromMinorUnits` ile bu sınırda çevrilir (bkz.
 * fixed-asset.repository.ts ile aynı disiplin).
 *
 * Onay akışı durum makinesi YOK (bkz. prisma/schema.prisma'daki 13. bölüm
 * notu) — `transitionToClosed`/`transitionToReopened` SADECE
 * kapanma/yeniden-açılma geçişini yönetir.
 */

function toSalesOpportunity(row: SalesOpportunityRow): SalesOpportunity {
  return {
    id: row.id,
    tenantId: row.tenantId,
    customerName: row.customerName,
    dealName: row.dealName,
    expectedValue: fromMinorUnits(Number(row.expectedValueMinor)),
    expectedCloseDate: row.expectedCloseDate.toISOString().slice(0, 10),
    stage: row.stage,
    winProbabilityOverride: row.winProbabilityOverride
      ? Number(row.winProbabilityOverride)
      : null,
    closedAt: row.closedAt ? row.closedAt.toISOString().slice(0, 10) : null,
    closedByUserName: row.closedByUserName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const salesOpportunityRepository = {
  async findByTenant(
    tenantId: string,
    filters: { stage?: SalesOpportunityStage; open?: boolean },
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<SalesOpportunity[]> {
    const rows = await client.salesOpportunity.findMany({
      where: {
        tenantId,
        ...(filters.stage ? { stage: filters.stage } : {}),
        ...(filters.open !== undefined
          ? filters.open
            ? { stage: { in: OPEN_SALES_STAGES } }
            : { stage: { notIn: OPEN_SALES_STAGES } }
          : {}),
      },
      orderBy: { expectedCloseDate: "asc" },
    });
    return rows.map(toSalesOpportunity);
  },

  async findWon(
    tenantId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<SalesOpportunity[]> {
    return this.findByTenant(tenantId, { stage: "WON" }, client);
  },

  async findOpen(
    tenantId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<SalesOpportunity[]> {
    return this.findByTenant(tenantId, { open: true }, client);
  },

  async findById(
    tenantId: string,
    id: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<SalesOpportunity | null> {
    const row = await client.salesOpportunity.findUnique({ where: { id } });
    return row && row.tenantId === tenantId ? toSalesOpportunity(row) : null;
  },

  async create(
    tenantId: string,
    input: CreateSalesOpportunityInput,
  ): Promise<SalesOpportunity> {
    const now = new Date();
    const row = await prisma.salesOpportunity.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        customerName: input.customerName,
        dealName: input.dealName,
        expectedValueMinor: BigInt(toMinorUnits(input.expectedValue)),
        expectedCloseDate: new Date(input.expectedCloseDate),
        stage: input.stage ?? "LEAD",
        winProbabilityOverride: input.winProbabilityOverride ?? null,
        createdAt: now,
      },
    });
    return toSalesOpportunity(row);
  },

  async update(
    tenantId: string,
    id: string,
    input: UpdateSalesOpportunityInput,
  ): Promise<SalesOpportunity | null> {
    // `updateMany` KASITLI: yanlış tenant'a ait bir id verilirse (RLS zaten
    // engeller, burası ikinci savunma hattı) sessizce 0 satır güncellenir —
    // diğer repository'lerdeki aynı disiplin (bkz. fixed-asset.repository.ts).
    const result = await prisma.salesOpportunity.updateMany({
      where: { id, tenantId },
      data: {
        ...(input.customerName !== undefined
          ? { customerName: input.customerName }
          : {}),
        ...(input.dealName !== undefined ? { dealName: input.dealName } : {}),
        ...(input.expectedValue !== undefined
          ? { expectedValueMinor: BigInt(toMinorUnits(input.expectedValue)) }
          : {}),
        ...(input.expectedCloseDate !== undefined
          ? { expectedCloseDate: new Date(input.expectedCloseDate) }
          : {}),
        ...(input.stage !== undefined ? { stage: input.stage } : {}),
        ...(input.winProbabilityOverride !== undefined
          ? { winProbabilityOverride: input.winProbabilityOverride }
          : {}),
      },
    });
    if (result.count === 0) return null;
    return this.findById(tenantId, id);
  },

  async transitionToClosed(
    tenantId: string,
    id: string,
    outcome: "WON" | "LOST",
    userId: string,
    userName: string,
  ): Promise<SalesOpportunity | null> {
    const result = await prisma.salesOpportunity.updateMany({
      where: { id, tenantId },
      data: {
        stage: outcome,
        closedAt: new Date(),
        closedByUserId: userId,
        closedByUserName: userName,
      },
    });
    if (result.count === 0) return null;
    return this.findById(tenantId, id);
  },

  async transitionToReopened(
    tenantId: string,
    id: string,
  ): Promise<SalesOpportunity | null> {
    const result = await prisma.salesOpportunity.updateMany({
      where: { id, tenantId },
      data: {
        stage: "LEAD",
        closedAt: null,
        closedByUserId: null,
        closedByUserName: null,
      },
    });
    if (result.count === 0) return null;
    return this.findById(tenantId, id);
  },
};
