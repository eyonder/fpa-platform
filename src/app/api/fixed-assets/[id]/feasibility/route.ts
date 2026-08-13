import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { fixedAssetService } from "@/backend/modules/fixed-assets/fixed-asset.service";

/**
 * İNCE CONTROLLER.
 * GET /api/fixed-assets/:id/feasibility — canlı NPV/IRR (herhangi bir
 * durumda), hiçbir şey YAZMAZ (bkz. fixed-asset.service.ts#feasibility).
 */
export const GET = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async ({ tenantId }) => {
      const { id } = await routeContext.params;
      return ok(await fixedAssetService.feasibility(tenantId, id));
    }),
);
