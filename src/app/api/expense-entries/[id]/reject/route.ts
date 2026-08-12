import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { expenseEntryService } from "@/backend/modules/cost-centers/expense-entry.service";
import { rejectExpenseEntrySchema } from "@/backend/modules/cost-centers/expense-entry.schema";

/**
 * İNCE CONTROLLER.
 * POST /api/expense-entries/:id/reject — { reason } — ONAYA GÖNDERİLDİ -> REDDEDİLDİ.
 */
export const POST = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "expense-entry:approve");
      const { id } = await routeContext.params;
      const input = rejectExpenseEntrySchema.parse(await request.json());
      return ok(await expenseEntryService.reject(context, id, input.reason));
    }),
);
