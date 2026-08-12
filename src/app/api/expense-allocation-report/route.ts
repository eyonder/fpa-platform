import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { expenseEntryService } from "@/backend/modules/cost-centers/expense-entry.service";
import { allocationReportQuerySchema } from "@/backend/modules/cost-centers/expense-entry.schema";

/**
 * İNCE CONTROLLER.
 * GET /api/expense-allocation-report?scenarioId= — SADECE BÜTÇEYE YAZILMIŞ
 * (COMMITTED) gider kayıtlarının, tahsis anahtarları uygulandıktan sonra
 * gider merkezleri arasında nasıl dağıldığını gösterir. Salt okunur, hiçbir
 * şey YAZMAZ (bkz. expense-entry.service.ts#allocationReport).
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = allocationReportQuerySchema.parse(params);
    return ok(await expenseEntryService.allocationReport(context, query.scenarioId));
  }),
);
