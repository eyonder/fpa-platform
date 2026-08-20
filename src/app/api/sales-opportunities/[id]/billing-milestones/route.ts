import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { salesOpportunityService } from "@/backend/modules/sales/sales-opportunity.service";
import { setBillingMilestonesSchema } from "@/backend/modules/sales/sales.schema";

/**
 * İNCE CONTROLLER.
 * GET  /api/sales-opportunities/:id/billing-milestones — bu fırsatın hakediş
 *      faturalama takvimi (tarih+tutar listesi), tanımlı değilse [].
 * POST /api/sales-opportunities/:id/billing-milestones — listeyi TAMAMEN
 *      değiştir. `sales-opportunity:write` yeterlidir — `allocation-key`
 *      route'undaki AYNI GET-korumasız/POST-write izin şekli (fırsat
 *      düzenlemenin bir parçası, `:commit` bütçeye yazma katmanıyla
 *      KARIŞTIRILMAMALI).
 */
export const GET = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async ({ tenantId }) => {
      const { id } = await routeContext.params;
      return ok(await salesOpportunityService.getBillingMilestones(tenantId, id));
    }),
);

export const POST = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async ({ tenantId, role }) => {
      assertPermission(role, "sales-opportunity:write");
      const { id } = await routeContext.params;
      const input = setBillingMilestonesSchema.parse(await request.json());
      return ok(
        await salesOpportunityService.setBillingMilestones(tenantId, id, input),
      );
    }),
);
