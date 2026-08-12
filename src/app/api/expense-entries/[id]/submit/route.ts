import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { expenseEntryService } from "@/backend/modules/cost-centers/expense-entry.service";

/**
 * İNCE CONTROLLER.
 * POST /api/expense-entries/:id/submit — TASLAK/REDDEDİLDİ -> ONAYA GÖNDERİLDİ.
 */
export const POST = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "expense-entry:write");
      const { id } = await routeContext.params;
      return ok(await expenseEntryService.submit(context, id));
    }),
);
