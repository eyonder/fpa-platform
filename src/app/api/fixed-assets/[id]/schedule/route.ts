import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { fixedAssetService } from "@/backend/modules/fixed-assets/fixed-asset.service";

/**
 * İNCE CONTROLLER.
 * GET /api/fixed-assets/:id/schedule — VUK kıst amortisman programının
 * TAMAMI (ay ay), her istekte YENİDEN üretilir, hiçbir yerde saklanmaz.
 */
export const GET = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async ({ tenantId }) => {
      const { id } = await routeContext.params;
      return ok(await fixedAssetService.schedule(tenantId, id));
    }),
);
