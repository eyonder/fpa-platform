import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { treasuryBalanceService } from "@/backend/modules/treasury/treasury-balance.service";
import { treasuryPositionSchema } from "@/backend/modules/treasury/treasury.schema";

/**
 * İNCE CONTROLLER.
 * GET /api/treasury/position?scenarioId=&startDate=&days= — nakit pozisyonu
 * (varsayılan 90 gün). Yalnızca OKUMA — `treasury:read` her rolde vardır,
 * ayrı bir assertPermission gerekmez (bkz. events/route.ts GET).
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async ({ tenantId }) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = treasuryPositionSchema.parse(params);
    return ok(await treasuryBalanceService.position(tenantId, query));
  }),
);
