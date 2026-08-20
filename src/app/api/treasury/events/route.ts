import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { treasuryEventService } from "@/backend/modules/treasury/treasury-event.service";
import {
  createCashFlowEventSchema,
  listCashFlowEventsSchema,
} from "@/backend/modules/treasury/treasury.schema";

/**
 * İNCE CONTROLLER.
 * GET  /api/treasury/events?scenarioId=&status= — listele/filtrele.
 * POST /api/treasury/events — yeni nakit olayı (elle giriş).
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async ({ tenantId }) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = listCashFlowEventsSchema.parse(params);
    return ok(await treasuryEventService.list(tenantId, query));
  }),
);

export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "treasury-event:write");
    const input = createCashFlowEventSchema.parse(await request.json());
    return ok(await treasuryEventService.create(context, input), 201);
  }),
);
