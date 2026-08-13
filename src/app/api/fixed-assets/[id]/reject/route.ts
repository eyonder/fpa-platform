import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { fixedAssetService } from "@/backend/modules/fixed-assets/fixed-asset.service";
import { rejectFixedAssetSchema } from "@/backend/modules/fixed-assets/fixed-asset.schema";

/**
 * İNCE CONTROLLER.
 * POST /api/fixed-assets/:id/reject — { reason } — ONAYA GÖNDERİLDİ -> REDDEDİLDİ.
 */
export const POST = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "fixed-asset:approve");
      const { id } = await routeContext.params;
      const input = rejectFixedAssetSchema.parse(await request.json());
      return ok(await fixedAssetService.reject(context, id, input.reason));
    }),
);
