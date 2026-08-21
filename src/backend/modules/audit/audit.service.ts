import type { PrismaClientOrTx } from "@/backend/core/prisma-client";
import { prismaAsTxClient } from "@/backend/core/prisma-client";
import type { RequestContext } from "@/backend/core/tenant";
import { budgetLineRepository } from "@/backend/modules/budget-lines/budget-line.repository";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import type {
  AuditLogEntry,
  AuditSource,
  BudgetLine,
  BudgetLineInput,
} from "@/shared/types";

import { auditRepository } from "./audit.repository";
import type { ListAuditLogsQuery } from "./audit.schema";

/**
 * İŞ MANTIĞI KATMANI (Service) — AUDIT MIDDLEWARE.
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * `recordBudgetLineChanges`, klasik bir HTTP middleware değil ama AYNI görevi
 * görür: mutasyon yapan HER yol (manuel hücre düzenleme, forecast persist,
 * import commit) veriyi yazmadan HEMEN ÖNCE bunu çağırır (bkz.
 * budget-line.service.ts). Böylece tek bir yerde:
 *   - Sadece GERÇEKTEN DEĞİŞEN hücreler kaydedilir (no-op yazma gürültü üretmez).
 *   - Eski değer / yeni değer / kullanıcı / kaynak HER ZAMAN birlikte tutulur.
 * Bu fonksiyonu atlayıp doğrudan budgetLineRepository.bulkUpsert çağıran
 * YENİ bir yol eklerseniz, o yol audit'siz kalır — yeni mutasyon noktaları
 * MUTLAKA budgetLineService.bulkUpsert üzerinden geçmeli.
 */
export async function recordBudgetLineChanges(
  context: RequestContext,
  scenarioId: string,
  before: BudgetLine[],
  after: BudgetLineInput[],
  source: AuditSource,
  client: PrismaClientOrTx = prismaAsTxClient,
): Promise<void> {
  const beforeByKey = new Map(
    before.map((l) => [`${l.categoryId}:${l.month}`, l.amount]),
  );

  for (const line of after) {
    const key = `${line.categoryId}:${line.month}`;
    const existed = beforeByKey.has(key);
    const oldValue = beforeByKey.get(key) ?? 0;
    if (existed && oldValue === line.amount) continue; // değişmeyen hücre -> kayıt üretme

    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      tenantId: context.tenantId,
      userId: context.userId,
      userName: context.userName,
      action: existed ? "UPDATE" : "CREATE",
      entityType: "BudgetLine",
      scenarioId,
      categoryId: line.categoryId,
      month: line.month,
      fieldName: "amount",
      oldValue,
      newValue: line.amount,
      occurredAt: new Date().toISOString(),
      source,
    };

    await auditRepository.record(entry, client);
  }
}

export const auditService = {
  recordBudgetLineChanges,

  async list(tenantId: string, query: ListAuditLogsQuery): Promise<AuditLogEntry[]> {
    const entries = await auditRepository.findByTenant(tenantId, {
      scenarioId: query.scenarioId,
    });

    // Görüntüleme için zenginleştir: scenarioId/categoryId ham id olarak
    // saklanır (doğru, sorgulanabilir), okunabilir adlar sadece burada eklenir.
    const [scenarios, categories] = await Promise.all([
      scenarioRepository.findMany(tenantId, {}),
      budgetLineRepository.findCategories(tenantId),
    ]);
    const scenarioNameById = new Map(scenarios.map((s) => [s.id, s.name]));
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

    return entries.map((e) => ({
      ...e,
      scenarioName: scenarioNameById.get(e.scenarioId) ?? e.scenarioId,
      categoryName: categoryNameById.get(e.categoryId) ?? e.categoryId,
    }));
  },
};
