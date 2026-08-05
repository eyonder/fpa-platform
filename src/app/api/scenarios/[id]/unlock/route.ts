import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { getRequestContext } from "@/backend/core/tenant";
import { scenarioService } from "@/backend/modules/scenarios/scenario.service";

/**
 * İNCE CONTROLLER.
 * POST /api/scenarios/:id/unlock — senaryonun kilidini açar (yeniden veri
 * girişine açar). Sadece scenario:lock izni olan roller (Admin, Bütçe Yöneticisi).
 */
export const POST = handleRoute(
  async (request: Request, routeContext: { params: Promise<{ id: string }> }) => {
    const context = await getRequestContext(request);
    assertPermission(context.role, "scenario:lock");

    const { id } = await routeContext.params;

    return ok(await scenarioService.setLocked(context.tenantId, id, false));
  },
);
