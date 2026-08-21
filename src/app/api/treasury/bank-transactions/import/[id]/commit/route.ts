import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { bankImportService } from "@/backend/modules/treasury/bank-import.service";

/**
 * İNCE CONTROLLER.
 * POST /api/treasury/bank-transactions/import/[id]/commit — geçerli satırları
 * `BankTransaction` olarak yazar. Mükerrer referanslı satırlar ATLANIR.
 */
type Params = { params: Promise<{ id: string }> };

export const POST = handleRoute((request: Request, { params }: Params) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "treasury-bank:write");
    const { id } = await params;
    return ok(await bankImportService.commit(context, id));
  }),
);
