import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { cashFlowQuerySchema } from "@/backend/modules/cash-flow/cash-flow.schema";
import { cashFlowService } from "@/backend/modules/cash-flow/cash-flow.service";

/**
 * İNCE CONTROLLER.
 * GET /api/cash-flow?scenarioId=...&periodStart=1&periodEnd=12
 *
 * `variance/route.ts` ile AYNI gerekçeyle izin kontrolü YOK — kiracının
 * kendi bütçe verisini okumak, bordro gibi hassas değil.
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async ({ tenantId }) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = cashFlowQuerySchema.parse(params);

    return ok(await cashFlowService.compute(tenantId, query));
  }),
);
