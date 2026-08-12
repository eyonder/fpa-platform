import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { expenseEntryService } from "@/backend/modules/cost-centers/expense-entry.service";
import { commitExpenseEntriesSchema } from "@/backend/modules/cost-centers/expense-entry.schema";

/**
 * İNCE CONTROLLER.
 * POST /api/expense-entries/commit — { scenarioId } — ONAYLANDI durumundaki
 * TÜM kayıtları süpürüp `budgetLineService.bulkUpsert` (kaynak: EXPENSE)
 * üzerinden bütçeye yazar, ardından COMMITTED işaretler.
 */
export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "expense-entry:approve");
    const input = commitExpenseEntriesSchema.parse(await request.json());
    return ok(await expenseEntryService.commitApproved(context, input.scenarioId));
  }),
);
