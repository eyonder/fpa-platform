import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { scenarioService } from "@/backend/modules/scenarios/scenario.service";

/**
 * İNCE CONTROLLER.
 * POST /api/scenarios/:id/lock — senaryoyu kilitler (onaylar).
 * Sadece scenario:lock izni olan roller (Admin, Bütçe Yöneticisi).
 */
export const POST = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "scenario:lock");

      const { id } = await routeContext.params;

      return ok(await scenarioService.setLocked(context.tenantId, id, true));
    }),
);
