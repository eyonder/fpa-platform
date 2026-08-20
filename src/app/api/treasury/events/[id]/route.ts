import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { treasuryEventService } from "@/backend/modules/treasury/treasury-event.service";
import { updateCashFlowEventSchema } from "@/backend/modules/treasury/treasury.schema";

/**
 * İNCE CONTROLLER.
 * GET    /api/treasury/events/:id — tek nakit olayı.
 * PATCH  /api/treasury/events/:id — düzenle (kilitli senaryoda 409).
 * DELETE /api/treasury/events/:id — sil (kilitli senaryoda 409).
 */
export const GET = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async ({ tenantId }) => {
      const { id } = await routeContext.params;
      return ok(await treasuryEventService.get(tenantId, id));
    }),
);

export const PATCH = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "treasury-event:write");
      const { id } = await routeContext.params;
      const input = updateCashFlowEventSchema.parse(await request.json());
      return ok(await treasuryEventService.update(context, id, input));
    }),
);

export const DELETE = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "treasury-event:write");
      const { id } = await routeContext.params;
      await treasuryEventService.delete(context, id);
      return ok({ deleted: true });
    }),
);
