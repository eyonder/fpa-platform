import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { expenseEntryService } from "@/backend/modules/cost-centers/expense-entry.service";
import {
  createExpenseEntrySchema,
  listExpenseEntriesSchema,
} from "@/backend/modules/cost-centers/expense-entry.schema";

/**
 * İNCE CONTROLLER.
 * GET  /api/expense-entries?scenarioId=&costCenterId=&status= — listele/filtrele.
 * POST /api/expense-entries — yeni TASLAK gider kaydı.
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = listExpenseEntriesSchema.parse(params);
    return ok(await expenseEntryService.list(context, query));
  }),
);

export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "expense-entry:write");
    const input = createExpenseEntrySchema.parse(await request.json());
    return ok(await expenseEntryService.create(context, input), 201);
  }),
);
