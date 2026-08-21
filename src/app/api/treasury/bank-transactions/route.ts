import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { bankService } from "@/backend/modules/treasury/bank.service";
import {
  createBankTransactionSchema,
  listBankTransactionsSchema,
} from "@/backend/modules/treasury/treasury.schema";

/**
 * İNCE CONTROLLER.
 * GET  /api/treasury/bank-transactions?fromDate=&toDate=&onlyUnmatched=
 * POST /api/treasury/bank-transactions — elle hareket girişi.
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async ({ tenantId }) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = listBankTransactionsSchema.parse(params);
    return ok(await bankService.listTransactions(tenantId, query));
  }),
);

export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "treasury-bank:write");
    const input = createBankTransactionSchema.parse(await request.json());
    return ok(await bankService.createTransaction(context, input), 201);
  }),
);
