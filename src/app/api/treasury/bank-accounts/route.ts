import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { bankService } from "@/backend/modules/treasury/bank.service";
import { createBankAccountSchema } from "@/backend/modules/treasury/treasury.schema";

/**
 * İNCE CONTROLLER.
 * GET  /api/treasury/bank-accounts — hesap listesi (banka + para birimi).
 * POST /api/treasury/bank-accounts — yeni hesap.
 *
 * BİR HESAP = BİR PARA BİRİMİ (bkz. prisma/schema.prisma'daki BankAccount notu).
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async ({ tenantId }) =>
    ok(await bankService.listAccounts(tenantId)),
  ),
);

export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "treasury-bank:write");
    const input = createBankAccountSchema.parse(await request.json());
    return ok(await bankService.createAccount(context, input), 201);
  }),
);
