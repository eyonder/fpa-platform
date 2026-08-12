import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { employeeService } from "@/backend/modules/personnel/employee.service";
import { createCompensationSchema } from "@/backend/modules/personnel/personnel.schema";

/**
 * İNCE CONTROLLER.
 * GET  /api/personnel/:id/compensation — ücret geçmişi (etkin tarihe göre).
 * POST /api/personnel/:id/compensation — yeni ücret kaydı ekle (raise/yeni işe alım).
 */
export const GET = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async ({ tenantId, role }) => {
      assertPermission(role, "payroll:read");
      const { id } = await routeContext.params;
      return ok(await employeeService.listCompensations(tenantId, id));
    }),
);

export const POST = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async ({ tenantId, role }) => {
      assertPermission(role, "payroll:write");
      const { id } = await routeContext.params;
      const input = createCompensationSchema.parse(await request.json());
      return ok(await employeeService.addCompensation(tenantId, id, input), 201);
    }),
);
