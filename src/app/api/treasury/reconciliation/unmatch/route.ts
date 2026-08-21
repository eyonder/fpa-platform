import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { reconciliationService } from "@/backend/modules/treasury/reconciliation.service";
import { unmatchSchema } from "@/backend/modules/treasury/treasury.schema";

/**
 * İNCE CONTROLLER.
 * POST /api/treasury/reconciliation/unmatch — eşleşmeyi GERİ ALIR
 * (olay NEUTRALIZED -> PLANNED). Geri alınabilirlik ZORUNLUDUR.
 */
export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "treasury-reconciliation:run");
    const input = unmatchSchema.parse(await request.json());
    await reconciliationService.unmatch(context, input);
    return ok({ unmatched: true });
  }),
);
