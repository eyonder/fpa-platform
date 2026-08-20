import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { salesForecastService } from "@/backend/modules/sales/sales-forecast.service";
import { salesForecastScenarioSchema } from "@/backend/modules/sales/sales.schema";

/**
 * İNCE CONTROLLER.
 * GET /api/sales-opportunities/actuals-preview?scenarioId= — ÖNİZLEME,
 * HİÇBİR ŞEY YAZMAZ. Bütçeye yazmak için bkz. actuals-commit.
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = salesForecastScenarioSchema.parse(params);
    return ok(await salesForecastService.previewActuals(context, query.scenarioId));
  }),
);
