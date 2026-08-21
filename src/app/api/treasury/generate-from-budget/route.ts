import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { budgetToCashService } from "@/backend/modules/treasury/budget-to-cash.service";
import { generateFromBudgetSchema } from "@/backend/modules/treasury/treasury.schema";

/**
 * İNCE CONTROLLER.
 * POST /api/treasury/generate-from-budget — bütçe/gerçekleşen satırlarından
 * nakit defteri üretir (tahakkuk -> nakit, ödeme vadesi konvansiyonuyla).
 *
 * `treasury-event:write` yeterlidir: ürettiği şey sıradan nakit olaylarıdır ve
 * bu iznin zaten kapsadığı veri girişidir (bkz. authorize.ts).
 */
export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "treasury-event:write");
    const input = generateFromBudgetSchema.parse(await request.json());
    return ok(await budgetToCashService.generate(context, input));
  }),
);
