import { prisma, prismaAsTxClient } from "@/backend/core/prisma-client";
import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import { fromMinorUnits, toMinorUnits } from "@/shared/lib/money";
import type { AuditLogEntry } from "@/shared/types";
import type { AuditLog as AuditLogRow } from "@prisma/client";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `AuditLog`, RLS'e tabi ama SADECE SELECT+INSERT politikası olan tek tablo
 * (bkz. `prisma/migrations/*_enable_rls/migration.sql`) — UPDATE/DELETE
 * politikası TANIMLANMAMIŞ, yani veritabanı seviyesinde REDDEDİLİR. Bu
 * repository'nin de sadece `record` (INSERT) ve `findByTenant` (SELECT)
 * SUNMASI, o DB kısıtının API yüzeyindeki karşılığıdır — burada bilerek
 * hiçbir "update"/"delete" metodu YOK.
 *
 * `oldValue`/`newValue` DB'de kuruş (`BigInt`) saklanır — bkz.
 * `budget-line.repository.ts`teki aynı disiplinin yorumu.
 */

function toAuditLogEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    userName: row.userName,
    action: row.action,
    entityType: row.entityType as "BudgetLine",
    scenarioId: row.scenarioId,
    categoryId: row.categoryId,
    month: row.month,
    fieldName: row.fieldName as "amount",
    oldValue: fromMinorUnits(Number(row.oldValue)),
    newValue: fromMinorUnits(Number(row.newValue)),
    occurredAt: row.occurredAt.toISOString(),
    source: row.source,
  };
}

export const auditRepository = {
  async record(
    entry: AuditLogEntry,
    client: PrismaClientOrTx = prismaAsTxClient,
  ): Promise<void> {
    await client.auditLog.create({
      data: {
        id: entry.id,
        tenantId: entry.tenantId,
        userId: entry.userId,
        userName: entry.userName,
        action: entry.action,
        entityType: entry.entityType,
        scenarioId: entry.scenarioId,
        categoryId: entry.categoryId,
        month: entry.month,
        fieldName: entry.fieldName,
        oldValue: BigInt(toMinorUnits(entry.oldValue)),
        newValue: BigInt(toMinorUnits(entry.newValue)),
        occurredAt: new Date(entry.occurredAt),
        source: entry.source,
      },
    });
  },

  async findByTenant(
    tenantId: string,
    filters: { scenarioId?: string } = {},
  ): Promise<AuditLogEntry[]> {
    const rows = await prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(filters.scenarioId ? { scenarioId: filters.scenarioId } : {}),
      },
      orderBy: { occurredAt: "desc" },
    });
    return rows.map(toAuditLogEntry);
  },
};
