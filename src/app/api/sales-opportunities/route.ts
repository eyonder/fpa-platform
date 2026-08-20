import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { salesOpportunityService } from "@/backend/modules/sales/sales-opportunity.service";
import {
  createSalesOpportunitySchema,
  listSalesOpportunitiesSchema,
} from "@/backend/modules/sales/sales.schema";

/**
 * İNCE CONTROLLER.
 * GET  /api/sales-opportunities?stage=&open= — listele/filtrele.
 * POST /api/sales-opportunities — yeni satış fırsatı (açık bir aşamada).
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async ({ tenantId }) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = listSalesOpportunitiesSchema.parse(params);
    return ok(await salesOpportunityService.list(tenantId, query));
  }),
);

export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async ({ tenantId, role }) => {
    assertPermission(role, "sales-opportunity:write");
    const input = createSalesOpportunitySchema.parse(await request.json());
    return ok(await salesOpportunityService.create(tenantId, input), 201);
  }),
);
