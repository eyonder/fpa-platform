import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { bankService } from "@/backend/modules/treasury/bank.service";
import { upsertBankBalanceSchema } from "@/backend/modules/treasury/treasury.schema";

/**
 * İNCE CONTROLLER.
 * GET /api/treasury/bank-balance — en güncel top bakiye + son 20 kayıt.
 * PUT /api/treasury/bank-balance — gün bazında UPSERT (POST DEĞİL: aynı gün
 *   için ikinci bir kayıt YARATILMAZ, üzerine yazılır — bkz. bank-balance.repository.ts).
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async ({ tenantId }) =>
    ok(await bankService.getBalance(tenantId)),
  ),
);

export const PUT = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "treasury-bank:write");
    const input = upsertBankBalanceSchema.parse(await request.json());
    return ok(await bankService.upsertBalance(context, input));
  }),
);
