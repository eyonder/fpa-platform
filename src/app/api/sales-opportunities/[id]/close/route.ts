import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { salesOpportunityService } from "@/backend/modules/sales/sales-opportunity.service";
import { closeSalesOpportunitySchema } from "@/backend/modules/sales/sales.schema";

/**
 * İNCE CONTROLLER.
 * POST /api/sales-opportunities/:id/close — { outcome: "WON"|"LOST" } —
 * AÇIK aşama -> KAPALI (closedAt damgalanır). `sales-opportunity:write`
 * yeterlidir — bu SATIŞ ekibinin günlük CRM işidir, `:commit` (ADMIN/Bütçe
 * Yöneticisi'ne özel bütçeye yazma) İLE KARIŞTIRILMAMALI.
 */
export const POST = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "sales-opportunity:write");
      const { id } = await routeContext.params;
      const input = closeSalesOpportunitySchema.parse(await request.json());
      return ok(await salesOpportunityService.close(context, id, input.outcome));
    }),
);
