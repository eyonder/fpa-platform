import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { salesOpportunityService } from "@/backend/modules/sales/sales-opportunity.service";
import { updateSalesOpportunitySchema } from "@/backend/modules/sales/sales.schema";

/**
 * İNCE CONTROLLER.
 * GET   /api/sales-opportunities/:id — tek satış fırsatı.
 * PATCH /api/sales-opportunities/:id — düzenle (yalnızca AÇIK aşamalarda).
 */
export const GET = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async ({ tenantId }) => {
      const { id } = await routeContext.params;
      return ok(await salesOpportunityService.get(tenantId, id));
    }),
);

export const PATCH = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async ({ tenantId, role }) => {
      assertPermission(role, "sales-opportunity:write");
      const { id } = await routeContext.params;
      const input = updateSalesOpportunitySchema.parse(await request.json());
      return ok(await salesOpportunityService.update(tenantId, id, input));
    }),
);
