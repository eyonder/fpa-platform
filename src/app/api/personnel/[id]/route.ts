import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { employeeService } from "@/backend/modules/personnel/employee.service";
import { updateEmployeeSchema } from "@/backend/modules/personnel/personnel.schema";

/**
 * İNCE CONTROLLER.
 * GET   /api/personnel/:id — tek personel.
 * PATCH /api/personnel/:id — personel bilgilerini güncelle (işten çıkış dahil).
 */
export const GET = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async ({ tenantId, role }) => {
      assertPermission(role, "payroll:read");
      const { id } = await routeContext.params;
      return ok(await employeeService.get(tenantId, id));
    }),
);

export const PATCH = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async ({ tenantId, role }) => {
      assertPermission(role, "payroll:write");
      const { id } = await routeContext.params;
      const input = updateEmployeeSchema.parse(await request.json());
      return ok(await employeeService.update(tenantId, id, input));
    }),
);
