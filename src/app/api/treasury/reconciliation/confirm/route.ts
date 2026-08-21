import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { reconciliationService } from "@/backend/modules/treasury/reconciliation.service";
import { confirmMatchesSchema } from "@/backend/modules/treasury/treasury.schema";

/**
 * İNCE CONTROLLER.
 * POST /api/treasury/reconciliation/confirm — seçilen çiftleri ONAYLAR.
 * HEPSİ YA DA HİÇBİRİ; çakışmada 409 RECONCILIATION_CONFLICT.
 */
export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "treasury-reconciliation:run");
    const input = confirmMatchesSchema.parse(await request.json());
    return ok(await reconciliationService.confirm(context, input));
  }),
);
