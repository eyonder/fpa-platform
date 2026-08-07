import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import {
  bulkUpsertBudgetLinesSchema,
  listBudgetLinesSchema,
} from "@/backend/modules/budget-lines/budget-line.schema";
import { budgetLineService } from "@/backend/modules/budget-lines/budget-line.service";

/**
 * İNCE CONTROLLER.
 * Görevi dört adımdır: bağlamı çöz → yetkiyi doğrula → girdiyi doğrula → servisi çağır.
 * Buraya asla iş mantığı (if/else hesap kuralı) yazılmaz.
 */

export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async ({ tenantId }) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = listBudgetLinesSchema.parse(params);

    return ok(await budgetLineService.getSheet(tenantId, query.scenarioId));
  }),
);

export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "budget-line:write");

    const input = bulkUpsertBudgetLinesSchema.parse(await request.json());

    return ok(
      await budgetLineService.bulkUpsert(context, input.scenarioId, input.lines),
    );
  }),
);
