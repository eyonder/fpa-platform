import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { getRequestContext } from "@/backend/core/tenant";
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

export const GET = handleRoute(async (request: Request) => {
  const { tenantId } = await getRequestContext(request);
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = listBudgetLinesSchema.parse(params);

  return ok(await budgetLineService.getSheet(tenantId, query.scenarioId));
});

export const POST = handleRoute(async (request: Request) => {
  const context = await getRequestContext(request);
  assertPermission(context.role, "budget-line:write");

  const input = bulkUpsertBudgetLinesSchema.parse(await request.json());

  return ok(await budgetLineService.bulkUpsert(context, input.scenarioId, input.lines));
});
