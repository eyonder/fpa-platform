import { prisma, prismaAsTxClient } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import type { CostCenter } from "@/shared/types";
import type { CostCenter as CostCenterRow } from "@prisma/client";

import type {
  CreateCostCenterInput,
  UpdateCostCenterInput,
} from "./cost-center.schema";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `CostCenter` RLS'e TABİDİR (Scenario/BudgetLine/AuditLog/ImportJob/Employee
 * setine katılır) — bkz. prisma/migrations/*_enable_rls_cost_centers/migration.sql.
 * Ağaç yapısı `organization.repository.ts`teki (Tenant.parentTenantId) AYNI
 * desen: `findDescendants` uygulama tarafında BFS ile (recursive CTE değil).
 */

function toCostCenter(row: CostCenterRow): CostCenter {
  return {
    id: row.id,
    tenantId: row.tenantId,
    code: row.code,
    name: row.name,
    parentCostCenterId: row.parentCostCenterId,
  };
}

export const costCenterRepository = {
  async findByTenant(
    tenantId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<CostCenter[]> {
    const rows = await client.costCenter.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
    return rows.map(toCostCenter);
  },

  async findById(
    tenantId: string,
    id: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<CostCenter | null> {
    const row = await client.costCenter.findUnique({ where: { id } });
    return row && row.tenantId === tenantId ? toCostCenter(row) : null;
  },

  async findByCode(
    tenantId: string,
    code: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<CostCenter | null> {
    const row = await client.costCenter.findFirst({ where: { tenantId, code } });
    return row ? toCostCenter(row) : null;
  },

  /** Sadece bir alt kademe (doğrudan çocuklar). */
  async findChildren(
    tenantId: string,
    parentCostCenterId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<CostCenter[]> {
    const rows = await client.costCenter.findMany({
      where: { tenantId, parentCostCenterId },
    });
    return rows.map(toCostCenter);
  },

  /** Tüm alt ağaç (çocuklar + torunlar + ...) — döngü doğrulaması için. */
  async findDescendants(
    tenantId: string,
    parentCostCenterId: string,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<CostCenter[]> {
    const result: CostCenter[] = [];
    const queue = [parentCostCenterId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await client.costCenter.findMany({
        where: { tenantId, parentCostCenterId: currentId },
      });
      for (const child of children) {
        const costCenter = toCostCenter(child);
        result.push(costCenter);
        queue.push(costCenter.id);
      }
    }

    return result;
  },

  async create(tenantId: string, input: CreateCostCenterInput): Promise<CostCenter> {
    const row = await prisma.costCenter.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        code: input.code,
        name: input.name,
        parentCostCenterId: input.parentCostCenterId ?? null,
      },
    });
    return toCostCenter(row);
  },

  async update(
    tenantId: string,
    id: string,
    input: UpdateCostCenterInput,
  ): Promise<CostCenter | null> {
    // `updateMany` KASITLI: yanlış tenant'a ait bir id verilirse (RLS zaten
    // engeller, burası ikinci savunma hattı) sessizce 0 satır güncellenir —
    // diğer repository'lerdeki aynı disiplin (bkz. scenario.repository.ts).
    const result = await prisma.costCenter.updateMany({
      where: { id, tenantId },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.parentCostCenterId !== undefined
          ? { parentCostCenterId: input.parentCostCenterId }
          : {}),
      },
    });
    if (result.count === 0) return null;
    return this.findById(tenantId, id);
  },
};
