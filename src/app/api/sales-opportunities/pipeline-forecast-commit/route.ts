import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { salesForecastService } from "@/backend/modules/sales/sales-forecast.service";
import { salesForecastScenarioSchema } from "@/backend/modules/sales/sales.schema";

/**
 * İNCE CONTROLLER.
 * POST /api/sales-opportunities/pipeline-forecast-commit — { scenarioId } —
 * SENARYO BAZLI, TEKRAR ÇALIŞTIRILABİLİR: AÇIK (LEAD/QUALIFIED/PROPOSAL/
 * NEGOTIATION) fırsatların beklenen kapanış ayına (expectedCloseDate) düşen,
 * kazanma olasılığıyla ağırlıklandırılmış tutarını toplayıp
 * `budgetLineService.bulkUpsert` (kaynak: SALES) üzerinden "Gelir"
 * kategorisine yazar. Kilit kontrolü ve audit kaydı oradan otomatik gelir.
 *
 * UYARI: actuals-commit İLE AYNI senaryoya işaret edilirse, ikisi de AYNI
 * kategoriye (cat-gelir) yazdığı için sonraki çağrı öncekinin tutarlarının
 * üzerine yazar (bkz. sales-forecast.service.ts dosya başı notu).
 */
export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "sales-opportunity:commit");
    const input = salesForecastScenarioSchema.parse(await request.json());
    return ok(
      await salesForecastService.commitPipelineForecast(context, input.scenarioId),
    );
  }),
);
