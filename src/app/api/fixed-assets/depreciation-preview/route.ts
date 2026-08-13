import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { depreciationService } from "@/backend/modules/fixed-assets/depreciation.service";
import { depreciationScenarioSchema } from "@/backend/modules/fixed-assets/fixed-asset.schema";

/**
 * İNCE CONTROLLER.
 * GET /api/fixed-assets/depreciation-preview?scenarioId= — ÖNİZLEME, HİÇBİR
 * ŞEY YAZMAZ. Bütçeye yazmak için bkz. depreciation-commit.
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = depreciationScenarioSchema.parse(params);
    return ok(await depreciationService.previewForScenario(context, query.scenarioId));
  }),
);
