import { prisma, prismaAsTxClient } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import type { MappingConfigEntry } from "@/shared/types";
import type { MappingConfig as MappingConfigRow } from "@prisma/client";

import type {
  CreateMappingConfigInput,
  UpdateMappingConfigInput,
} from "./treasury.schema";
import type { ThpStarterMapping } from "./thp-starter-set";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `MappingConfig` RLS'e TABİDİR — `BudgetCategory`'nin AKSİNE (küresel), THP
 * kodu -> kategori eşleştirmesi TENANT'A ÖZEL bir politika kararıdır (bkz.
 * prisma/schema.prisma'daki 14. bölüm notu).
 */

function toMappingConfig(row: MappingConfigRow): MappingConfigEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    accountCode: row.accountCode,
    accountName: row.accountName,
    categoryId: row.categoryId,
    direction: row.direction,
    layer: row.layer,
    defaultTermDays: row.defaultTermDays,
    isActive: row.isActive,
    note: row.note,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const mappingConfigRepository = {
  async findByTenant(
    tenantId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<MappingConfigEntry[]> {
    const rows = await client.mappingConfig.findMany({
      where: { tenantId },
      orderBy: { accountCode: "asc" },
    });
    return rows.map(toMappingConfig);
  },

  /** SADECE aktif kurallar — THP satır çözümlemesinde kullanılır (bkz.
   * thp-mapping.ts#resolveThpMapping: `isActive` orada da filtrelenir, burası
   * gereksiz veri çekmeyi önleyen ilk savunma hattı). */
  async findActiveByTenant(
    tenantId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<MappingConfigEntry[]> {
    const rows = await client.mappingConfig.findMany({
      where: { tenantId, isActive: true },
      orderBy: { accountCode: "asc" },
    });
    return rows.map(toMappingConfig);
  },

  async findById(
    tenantId: string,
    id: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<MappingConfigEntry | null> {
    const row = await client.mappingConfig.findUnique({ where: { id } });
    return row && row.tenantId === tenantId ? toMappingConfig(row) : null;
  },

  async findByAccountCode(
    tenantId: string,
    accountCode: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<MappingConfigEntry | null> {
    const row = await client.mappingConfig.findFirst({
      where: { tenantId, accountCode },
    });
    return row ? toMappingConfig(row) : null;
  },

  async create(
    tenantId: string,
    userId: string,
    input: CreateMappingConfigInput,
  ): Promise<MappingConfigEntry> {
    const row = await prisma.mappingConfig.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        accountCode: input.accountCode,
        accountName: input.accountName,
        categoryId: input.categoryId,
        direction: input.direction,
        layer: input.layer ?? "CASH",
        defaultTermDays: input.defaultTermDays ?? null,
        isActive: input.isActive ?? true,
        note: input.note ?? null,
        createdByUserId: userId,
      },
    });
    return toMappingConfig(row);
  },

  async update(
    tenantId: string,
    id: string,
    input: UpdateMappingConfigInput,
  ): Promise<MappingConfigEntry | null> {
    // `updateMany` KASITLI — diğer repository'lerdeki aynı disiplin (bkz.
    // cash-flow-event.repository.ts).
    const result = await prisma.mappingConfig.updateMany({
      where: { id, tenantId },
      data: {
        ...(input.accountCode !== undefined ? { accountCode: input.accountCode } : {}),
        ...(input.accountName !== undefined ? { accountName: input.accountName } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.direction !== undefined ? { direction: input.direction } : {}),
        ...(input.layer !== undefined ? { layer: input.layer } : {}),
        ...(input.defaultTermDays !== undefined
          ? { defaultTermDays: input.defaultTermDays }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    });
    if (result.count === 0) return null;
    return this.findById(tenantId, id);
  },

  async delete(tenantId: string, id: string): Promise<boolean> {
    const result = await prisma.mappingConfig.deleteMany({ where: { id, tenantId } });
    return result.count > 0;
  },

  /** Varsayılan THP setini yazar — zaten var olan `(tenantId, accountCode)`
   * çiftlerini `skipDuplicates` ile SESSİZCE atlar (Postgres'e özgü Prisma
   * özelliği), tekrar tıklamak hata VERMEZ. */
  async seedDefaults(
    tenantId: string,
    userId: string,
    defaults: ThpStarterMapping[],
  ): Promise<MappingConfigEntry[]> {
    await prisma.mappingConfig.createMany({
      data: defaults.map((d) => ({
        id: crypto.randomUUID(),
        tenantId,
        accountCode: d.accountCode,
        accountName: d.accountName,
        categoryId: d.categoryId,
        direction: d.direction,
        layer: d.layer,
        defaultTermDays: d.defaultTermDays ?? null,
        isActive: true,
        createdByUserId: userId,
      })),
      skipDuplicates: true,
    });
    return this.findByTenant(tenantId);
  },
};
