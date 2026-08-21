import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { ValidationError } from "@/backend/core/errors";
import { bankImportService } from "@/backend/modules/treasury/bank-import.service";

/**
 * İNCE CONTROLLER.
 * POST /api/treasury/bank-transactions/import/[id]/commit — geçerli satırları
 * `BankTransaction` olarak yazar. Mükerrer referanslı satırlar ATLANIR.
 *
 * Gövde `{ bankAccountId }` ZORUNLU: bir ekstre TEK bir banka hesabına aittir
 * ve tutarları o hesabın para birimindedir — hesabı seçtirmeden yazmak, USD
 * bir ekstreyi TL hesaba dökmek gibi sessiz bir hata sınıfı açardı.
 */
type Params = { params: Promise<{ id: string }> };

export const POST = handleRoute((request: Request, { params }: Params) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "treasury-bank:write");
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      bankAccountId?: unknown;
    };
    if (typeof body.bankAccountId !== "string" || !body.bankAccountId) {
      throw new ValidationError({ bankAccountId: ["Banka hesabı seçilmeli."] });
    }
    return ok(await bankImportService.commit(context, id, body.bankAccountId));
  }),
);
