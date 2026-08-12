import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { payrollRunSchema } from "@/backend/modules/personnel/personnel.schema";
import { payrollService } from "@/backend/modules/personnel/payroll.service";

/**
 * İNCE CONTROLLER.
 * POST /api/personnel/payroll-run — { scenarioId } — ÖNİZLEME, HİÇBİR ŞEY
 * YAZMAZ. Bütçeye yazmak için bkz. /api/personnel/payroll-run/commit.
 */
export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "payroll:read");
    const input = payrollRunSchema.parse(await request.json());
    return ok(await payrollService.preview(context, input.scenarioId));
  }),
);
