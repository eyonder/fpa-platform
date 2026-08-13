import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { fixedAssetService } from "@/backend/modules/fixed-assets/fixed-asset.service";
import { updateFixedAssetSchema } from "@/backend/modules/fixed-assets/fixed-asset.schema";

/**
 * İNCE CONTROLLER.
 * GET   /api/fixed-assets/:id — tek sabit kıymet.
 * PATCH /api/fixed-assets/:id — düzenle (yalnızca TASLAK/REDDEDİLDİ).
 */
export const GET = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async ({ tenantId }) => {
      const { id } = await routeContext.params;
      return ok(await fixedAssetService.get(tenantId, id));
    }),
);

export const PATCH = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async ({ tenantId, role }) => {
      assertPermission(role, "fixed-asset:write");
      const { id } = await routeContext.params;
      const input = updateFixedAssetSchema.parse(await request.json());
      return ok(await fixedAssetService.update(tenantId, id, input));
    }),
);
