import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { depreciationService } from "@/backend/modules/fixed-assets/depreciation.service";
import { depreciationScenarioSchema } from "@/backend/modules/fixed-assets/fixed-asset.schema";

/**
 * İNCE CONTROLLER.
 * POST /api/fixed-assets/depreciation-commit — { scenarioId } — SENARYO
 * BAZLI, TEKRAR ÇALIŞTIRILABİLİR: ONAYLANMIŞ TÜM sabit kıymetlerin bu mali
 * yıla düşen amortismanını toplayıp `budgetLineService.bulkUpsert`
 * (kaynak: DEPRECIATION) üzerinden "Amortisman Giderleri" kategorisine
 * yazar. Kilit kontrolü ve audit kaydı oradan otomatik gelir.
 */
export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "fixed-asset:approve");
    const input = depreciationScenarioSchema.parse(await request.json());
    return ok(await depreciationService.commitForScenario(context, input.scenarioId));
  }),
);
