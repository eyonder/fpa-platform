import { AppError, NotFoundError } from "@/backend/core/errors";
import { withTenantTransaction } from "@/backend/core/prisma-client";
import type { RequestContext } from "@/backend/core/tenant";
import { auditService } from "@/backend/modules/audit/audit.service";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import type {
  AuditSource,
  BudgetLine,
  BudgetLineInput,
  BudgetSheet,
} from "@/shared/types";

import { budgetLineRepository } from "./budget-line.repository";

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * Tenant izolasyonu burada uygulanır: bir scenarioId'nin gerçekten bu
 * tenant'a ait olduğu HER istekte doğrulanır (Prisma + RLS'e geçilince bu
 * aynı zamanda veritabanı seviyesinde de zorunlu kılınacak — bkz. RLS notu
 * scenario.repository.ts'te). Kilitli (isLocked) senaryolarda veri girişi
 * reddedilir; bütçe giriş tablosu bunu salt-okunur göstererek yansıtır.
 *
 * `bulkUpsert`, TEK bütçe hücresi yazma noktasıdır: manuel grid düzenlemesi,
 * forecast persist ve import commit HEPSİ buradan geçer. Bu sayede kilit
 * kontrolü ve audit kaydı (bkz. audit.service.ts) her yolda aynı şekilde
 * uygulanır — üç ayrı yerde üç kez yazılmaz.
 */
export const budgetLineService = {
  async getSheet(tenantId: string, scenarioId: string): Promise<BudgetSheet> {
    const scenario = await scenarioRepository.findById(tenantId, scenarioId);
    if (!scenario) throw new NotFoundError("Senaryo");

    const [categories, lines] = await Promise.all([
      budgetLineRepository.findCategories(),
      budgetLineRepository.findByScenario(scenarioId),
    ]);

    return { scenarioId, categories, lines };
  },

  /**
   * Senaryo kilit kontrolü + audit kaydı + gerçek yazma HEPSİ TEK bir
   * `withTenantTransaction` içinde atomik olarak çalışır (eskiden 3 ayrı,
   * transactional OLMAYAN çağrıydı — bu, migration'dan bağımsız zaten
   * var olan gizli bir tutarlılık açığıydı, burada da düzeltildi). `tx`,
   * `SET LOCAL app.current_tenant_id`i transaction'ın İLK ifadesi olarak
   * çalıştırır (bkz. `backend/core/prisma-client.ts`); bu yüzden her
   * repository çağrısına AYNI `tx` geçirilir — `prisma`nın otomatik
   * sarmalaması ZATEN açık bir transaction'a iç içe giremez.
   */
  async bulkUpsert(
    context: RequestContext,
    scenarioId: string,
    lines: BudgetLineInput[],
    source: AuditSource = "MANUAL_EDIT",
  ): Promise<BudgetLine[]> {
    return withTenantTransaction(context.tenantId, async (tx) => {
      const scenario = await scenarioRepository.findById(
        context.tenantId,
        scenarioId,
        tx,
      );
      if (!scenario) throw new NotFoundError("Senaryo");

      if (scenario.isLocked) {
        throw new AppError(
          "SCENARIO_LOCKED",
          `"${scenario.name}" kilitli. Veri girmeden önce senaryonun kilidini açın.`,
          409,
        );
      }

      const before = await budgetLineRepository.findByScenario(scenarioId, tx);
      await auditService.recordBudgetLineChanges(
        context,
        scenarioId,
        before,
        lines,
        source,
        tx,
      );

      return budgetLineRepository.bulkUpsert(scenarioId, context.tenantId, lines, tx);
    });
  },
};
