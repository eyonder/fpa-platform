import { handleRoute, ok } from "@/backend/core/http";
import { getRequestContext } from "@/backend/core/tenant";
import { compareVarianceSchema } from "@/backend/modules/variance/variance.schema";
import { varianceService } from "@/backend/modules/variance/variance.service";

/**
 * İNCE CONTROLLER.
 * Görevi üç adımdır: bağlamı çöz → girdiyi doğrula → servisi çağır.
 * Buraya asla iş mantığı (if/else hesap kuralı) yazılmaz.
 *
 * GET /api/variance
 *   ?budgetScenarioId=...&actualScenarioId=...&periodStart=1&periodEnd=6
 */
export const GET = handleRoute(async (request: Request) => {
  const { tenantId } = await getRequestContext(request);
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = compareVarianceSchema.parse(params);

  return ok(await varianceService.compare(tenantId, query));
});
