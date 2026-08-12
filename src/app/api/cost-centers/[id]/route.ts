import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { updateCostCenterSchema } from "@/backend/modules/cost-centers/cost-center.schema";
import { costCenterService } from "@/backend/modules/cost-centers/cost-center.service";

/**
 * İNCE CONTROLLER.
 * GET   /api/cost-centers/:id — tek gider merkezi.
 * PATCH /api/cost-centers/:id — ad/kod/üst merkez güncelle.
 */
export const GET = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async ({ tenantId }) => {
      const { id } = await routeContext.params;
      return ok(await costCenterService.get(tenantId, id));
    }),
);

export const PATCH = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "cost-center:write");
      const { id } = await routeContext.params;
      const input = updateCostCenterSchema.parse(await request.json());
      return ok(await costCenterService.update(context.tenantId, id, input));
    }),
);
