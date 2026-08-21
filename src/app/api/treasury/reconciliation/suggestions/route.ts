import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { reconciliationService } from "@/backend/modules/treasury/reconciliation.service";
import { reconciliationSuggestionsSchema } from "@/backend/modules/treasury/treasury.schema";

/**
 * İNCE CONTROLLER.
 * POST /api/treasury/reconciliation/suggestions — eşleşme ÖNERİLERİ.
 *
 * GET DEĞİL POST: gövdede tolerans/pencere parametreleri taşınır ve istek
 * sunucuda gerçek bir hesaplama başlatır (idempotent okuma değil, "çalıştır"
 * semantiği) — `treasury-reconciliation:run` izniyle aynı çizgide.
 * HİÇBİR ŞEY YAZMAZ; onay ayrı bir çağrıdır (bkz. reconciliation.matcher.ts).
 */
export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "treasury-reconciliation:run");
    const query = reconciliationSuggestionsSchema.parse(await request.json());
    return ok(await reconciliationService.suggestions(context.tenantId, query));
  }),
);
