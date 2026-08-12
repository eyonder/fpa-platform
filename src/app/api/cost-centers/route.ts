import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { createCostCenterSchema } from "@/backend/modules/cost-centers/cost-center.schema";
import { costCenterService } from "@/backend/modules/cost-centers/cost-center.service";

/**
 * İNCE CONTROLLER.
 * GET  /api/cost-centers — tenant'ın düz gider merkezi listesi (arayüz ağacı kurar).
 * POST /api/cost-centers — yeni gider merkezi.
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async ({ tenantId }) => {
    return ok(await costCenterService.list(tenantId));
  }),
);

export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "cost-center:write");
    const input = createCostCenterSchema.parse(await request.json());
    return ok(await costCenterService.create(context.tenantId, input), 201);
  }),
);
