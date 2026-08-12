import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { upsertAllocationKeySchema } from "@/backend/modules/cost-centers/cost-center.schema";
import { costCenterService } from "@/backend/modules/cost-centers/cost-center.service";

/**
 * İNCE CONTROLLER.
 * GET  /api/cost-centers/:id/allocation-key — bu merkezin (kaynak) tahsis
 *      anahtarı + üyeleri, tanımlı değilse null.
 * POST /api/cost-centers/:id/allocation-key — oluştur ya da üye listesini
 *      TAMAMEN değiştir (bkz. allocation-key.repository.ts).
 */
export const GET = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async ({ tenantId }) => {
      const { id } = await routeContext.params;
      return ok(await costCenterService.getAllocationKey(tenantId, id));
    }),
);

export const POST = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "cost-center:write");
      const { id } = await routeContext.params;
      const input = upsertAllocationKeySchema.parse(await request.json());
      return ok(await costCenterService.setAllocationKey(context.tenantId, id, input));
    }),
);
