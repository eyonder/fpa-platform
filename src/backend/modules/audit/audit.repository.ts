import type { AuditLogEntry } from "@/shared/types";

/**
 * VERİ ERİŞİM KATMANI (Repository).
 *
 * Şu an bellekte, DEĞİŞTİRİLEMEZ (append-only) bir liste olarak tutulur —
 * gerçek AuditLogs tablosu (bkz. proje kökündeki Prisma şeması) UPDATE/DELETE
 * politikası TANIMLANMAMIŞ bir RLS tablosuydu; buradaki `record`'un sadece
 * `push` yapıp hiçbir "update"/"delete" metodu SUNMAMASI, o kısıtın bu
 * bellek-içi katmandaki karşılığıdır.
 */

const entries: AuditLogEntry[] = [];

export const auditRepository = {
  async record(entry: AuditLogEntry): Promise<void> {
    entries.push(entry);
  },

  async findByTenant(
    tenantId: string,
    filters: { scenarioId?: string } = {},
  ): Promise<AuditLogEntry[]> {
    return entries
      .filter((e) => e.tenantId === tenantId)
      .filter((e) => !filters.scenarioId || e.scenarioId === filters.scenarioId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  },
};
