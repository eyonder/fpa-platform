import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { salesOpportunityService } from "@/backend/modules/sales/sales-opportunity.service";

/**
 * İNCE CONTROLLER.
 * POST /api/sales-opportunities/:id/reopen — KAPALI -> LEAD (closedAt temizlenir).
 */
export const POST = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "sales-opportunity:write");
      const { id } = await routeContext.params;
      return ok(await salesOpportunityService.reopen(context, id));
    }),
);
