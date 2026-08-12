import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { expenseEntryService } from "@/backend/modules/cost-centers/expense-entry.service";

/**
 * İNCE CONTROLLER.
 * POST /api/expense-entries/:id/approve — ONAYA GÖNDERİLDİ -> ONAYLANDI.
 * DATA_ENTRY'ye VERİLMEZ (bkz. authorize.ts) — kendi gönderdiği kaydı
 * kendisi onaylayamasın diye.
 */
export const POST = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "expense-entry:approve");
      const { id } = await routeContext.params;
      return ok(await expenseEntryService.approve(context, id));
    }),
);
