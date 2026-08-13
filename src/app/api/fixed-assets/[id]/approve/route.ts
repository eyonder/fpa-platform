import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { fixedAssetService } from "@/backend/modules/fixed-assets/fixed-asset.service";

/**
 * İNCE CONTROLLER.
 * POST /api/fixed-assets/:id/approve — ONAYA GÖNDERİLDİ -> ONAYLANDI.
 * DATA_ENTRY'ye VERİLMEZ (bkz. authorize.ts) — kendi gönderdiği kaydı
 * kendisi onaylayamasın diye.
 */
export const POST = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "fixed-asset:approve");
      const { id } = await routeContext.params;
      return ok(await fixedAssetService.approve(context, id));
    }),
);
