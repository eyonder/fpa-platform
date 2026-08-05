import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { getRequestContext } from "@/backend/core/tenant";
import { generateForecastSchema } from "@/backend/modules/forecast/forecast.schema";
import { forecastService } from "@/backend/modules/forecast/forecast.service";

/**
 * İNCE CONTROLLER.
 * Görevi dört adımdır: bağlamı çöz → yetkiyi doğrula → girdiyi doğrula → servisi çağır.
 * Buraya asla iş mantığı (if/else hesap kuralı) yazılmaz.
 *
 * POST /api/forecast
 *   { actualScenarioId, forecastScenarioId, asOfMonth, categoryIds?, persist? }
 */
export const POST = handleRoute(async (request: Request) => {
  const context = await getRequestContext(request);
  assertPermission(context.role, "forecast:run");

  const input = generateForecastSchema.parse(await request.json());

  return ok(await forecastService.generate(context, input));
});
