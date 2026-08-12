import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { payrollRunSchema } from "@/backend/modules/personnel/personnel.schema";
import { payrollService } from "@/backend/modules/personnel/payroll.service";

/**
 * İNCE CONTROLLER.
 * POST /api/personnel/payroll-run/commit — { scenarioId } — önizlemeyi
 * TEKRAR hesaplayıp `budgetLineService.bulkUpsert` (source: PAYROLL)
 * üzerinden "Personel Giderleri" kategorisine yazar. Kilit kontrolü ve
 * audit kaydı oradan otomatik gelir.
 */
export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "payroll:write");
    const input = payrollRunSchema.parse(await request.json());
    return ok(await payrollService.commitToBudget(context, input.scenarioId));
  }),
);
