import { prisma, prismaAsTxClient } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import { fromMinorUnits, toMinorUnits } from "@/shared/lib/money";
import type {
  CashFlowProjectionEntry,
  FixedAsset,
  FixedAssetCategory,
  FixedAssetStatus,
} from "@/shared/types";
import type { FixedAsset as FixedAssetRow } from "@prisma/client";

import type {
  CreateFixedAssetInput,
  UpdateFixedAssetInput,
} from "./fixed-asset.schema";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `FixedAsset` RLS'e TABİDİR. DB'de tutar `baseValueMinor` (kuruş, `BigInt`)
 * olarak saklanır — `shared/lib/money.ts`teki `toMinorUnits`/`fromMinorUnits`
 * ile bu sınırda çevrilir (bkz. expense-entry.repository.ts ile aynı disiplin).
 * `cashFlowProjectionMinor` (Json) de aynı şekilde kuruş cinsinden saklanır,
 * domain tipine (`amount`, majör birim) burada çevrilir.
 *
 * `markCommitted` YOK — `FixedAsset`'in COMMITTED durumu yok (bkz.
 * prisma/schema.prisma'daki 12. bölüm notu).
 */

interface RawCashFlowEntry {
  year: number;
  amountMinor: number;
}

function toCashFlowProjection(json: unknown): CashFlowProjectionEntry[] {
  const raw = json as RawCashFlowEntry[];
  return raw.map((entry) => ({
    year: entry.year,
    amount: fromMinorUnits(entry.amountMinor),
  }));
}

function toCashFlowProjectionMinor(
  entries: CashFlowProjectionEntry[],
): RawCashFlowEntry[] {
  return entries.map((entry) => ({
    year: entry.year,
    amountMinor: toMinorUnits(entry.amount),
  }));
}

function toFixedAsset(row: FixedAssetRow): FixedAsset {
  return {
    id: row.id,
    tenantId: row.tenantId,
    assetName: row.assetName,
    category: row.category,
    acquisitionDate: row.acquisitionDate.toISOString().slice(0, 10),
    baseValue: fromMinorUnits(Number(row.baseValueMinor)),
    usefulLifeYearsOverride: row.usefulLifeYearsOverride,
    cashFlowProjection: toCashFlowProjection(row.cashFlowProjectionMinor),
    discountRate: Number(row.discountRate),
    description: row.description,
    status: row.status,
    submittedByUserName: row.submittedByUserName,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    decidedByUserName: row.decidedByUserName,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    rejectionReason: row.rejectionReason,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const fixedAssetRepository = {
  async findByTenant(
    tenantId: string,
    filters: { category?: FixedAssetCategory; status?: FixedAssetStatus },
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<FixedAsset[]> {
    const rows = await client.fixedAsset.findMany({
      where: {
        tenantId,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { acquisitionDate: "asc" },
    });
    return rows.map(toFixedAsset);
  },

  async findApproved(
    tenantId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<FixedAsset[]> {
    return this.findByTenant(tenantId, { status: "APPROVED" }, client);
  },

  async findById(
    tenantId: string,
    id: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<FixedAsset | null> {
    const row = await client.fixedAsset.findUnique({ where: { id } });
    return row && row.tenantId === tenantId ? toFixedAsset(row) : null;
  },

  async create(tenantId: string, input: CreateFixedAssetInput): Promise<FixedAsset> {
    const now = new Date();
    const row = await prisma.fixedAsset.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        assetName: input.assetName,
        category: input.category,
        acquisitionDate: new Date(input.acquisitionDate),
        baseValueMinor: BigInt(toMinorUnits(input.baseValue)),
        usefulLifeYearsOverride: input.usefulLifeYearsOverride ?? null,
        cashFlowProjectionMinor: toCashFlowProjectionMinor(input.cashFlowProjection),
        discountRate: input.discountRate,
        description: input.description ?? null,
        status: "DRAFT",
        createdAt: now,
      },
    });
    return toFixedAsset(row);
  },

  async update(
    tenantId: string,
    id: string,
    input: UpdateFixedAssetInput,
  ): Promise<FixedAsset | null> {
    // `updateMany` KASITLI: yanlış tenant'a ait bir id verilirse (RLS zaten
    // engeller, burası ikinci savunma hattı) sessizce 0 satır güncellenir —
    // diğer repository'lerdeki aynı disiplin (bkz. scenario.repository.ts).
    const result = await prisma.fixedAsset.updateMany({
      where: { id, tenantId },
      data: {
        ...(input.assetName !== undefined ? { assetName: input.assetName } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.acquisitionDate !== undefined
          ? { acquisitionDate: new Date(input.acquisitionDate) }
          : {}),
        ...(input.baseValue !== undefined
          ? { baseValueMinor: BigInt(toMinorUnits(input.baseValue)) }
          : {}),
        ...(input.usefulLifeYearsOverride !== undefined
          ? { usefulLifeYearsOverride: input.usefulLifeYearsOverride }
          : {}),
        ...(input.cashFlowProjection !== undefined
          ? {
              cashFlowProjectionMinor: toCashFlowProjectionMinor(
                input.cashFlowProjection,
              ),
            }
          : {}),
        ...(input.discountRate !== undefined
          ? { discountRate: input.discountRate }
          : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
    });
    if (result.count === 0) return null;
    return this.findById(tenantId, id);
  },

  async transitionToSubmitted(
    tenantId: string,
    id: string,
    userId: string,
    userName: string,
  ): Promise<FixedAsset | null> {
    const result = await prisma.fixedAsset.updateMany({
      where: { id, tenantId },
      data: {
        status: "SUBMITTED",
        submittedByUserId: userId,
        submittedByUserName: userName,
        submittedAt: new Date(),
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
  ): Promise<FixedAsset | null> {
    const result = await prisma.fixedAsset.updateMany({
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
  ): Promise<FixedAsset | null> {
    const result = await prisma.fixedAsset.updateMany({
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
};
