import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { reconciliationService } from "@/backend/modules/treasury/reconciliation.service";
import { promoteTransactionSchema } from "@/backend/modules/treasury/treasury.schema";

/**
 * İNCE CONTROLLER.
 * POST /api/treasury/reconciliation/promote — hiç tahmin edilmemiş gerçek
 * bir hareketi deftere ekler (NEUTRALIZED olay yaratıp anında eşleştirir).
 */
export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "treasury-reconciliation:run");
    const input = promoteTransactionSchema.parse(await request.json());
    return ok(await reconciliationService.promote(context, input), 201);
  }),
);
