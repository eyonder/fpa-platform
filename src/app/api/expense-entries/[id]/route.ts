import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { expenseEntryService } from "@/backend/modules/cost-centers/expense-entry.service";
import { updateExpenseEntrySchema } from "@/backend/modules/cost-centers/expense-entry.schema";

/**
 * İNCE CONTROLLER.
 * PATCH /api/expense-entries/:id — tutarı düzenle (yalnızca TASLAK/REDDEDİLDİ).
 */
export const PATCH = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "expense-entry:write");
      const { id } = await routeContext.params;
      const input = updateExpenseEntrySchema.parse(await request.json());
      return ok(await expenseEntryService.update(context, id, input.amount));
    }),
);
