import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { dashboardSummarySchema } from "@/backend/modules/dashboard/dashboard.schema";
import { dashboardService } from "@/backend/modules/dashboard/dashboard.service";

/**
 * İNCE CONTROLLER.
 * Görevi üç adımdır: bağlamı çöz → girdiyi doğrula → servisi çağır.
 * Buraya asla iş mantığı (if/else hesap kuralı) yazılmaz.
 *
 * GET /api/dashboard-summary
 *   ?budgetScenarioId=&actualScenarioId=&fiscalYear=&asOfMonth=&categoryType=EXPENSE|INCOME
 *
 * Salt okunur, toplu bir görünüm — budget-lines'ı okuyabilen herkes (tüm
 * roller) görebilir; ayrı bir RBAC izni gerektirmez.
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async ({ tenantId }) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = dashboardSummarySchema.parse(params);

    return ok(await dashboardService.getSummary(tenantId, query));
  }),
);
