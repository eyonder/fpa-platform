import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { employeeService } from "@/backend/modules/personnel/employee.service";
import { createEmployeeSchema } from "@/backend/modules/personnel/personnel.schema";

/**
 * İNCE CONTROLLER.
 * GET  /api/personnel  — personel listesi.
 * POST /api/personnel  — yeni personel ekle.
 * SADECE ADMIN (payroll:read/payroll:write) — maaş verisi gizliliği,
 * bkz. backend/core/authorize.ts'teki not.
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async ({ tenantId, role }) => {
    assertPermission(role, "payroll:read");
    return ok(await employeeService.list(tenantId));
  }),
);

export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async ({ tenantId, role }) => {
    assertPermission(role, "payroll:write");
    const input = createEmployeeSchema.parse(await request.json());
    return ok(await employeeService.create(tenantId, input), 201);
  }),
);
