import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { treasuryImportService } from "@/backend/modules/treasury/treasury-import.service";

/**
 * İNCE CONTROLLER.
 * POST /api/treasury/imports/:id/commit — geçerli (eşleşmiş, NAKİT katmanı,
 * vadesi çözümlenmiş) satırları CashFlowEvent'e yazar (kilit kontrolü,
 * senaryo bazlı `withTenantTransaction` içinde — bkz. treasury-import.service.ts).
 */
export const POST = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "treasury-event:write");
      const { id } = await routeContext.params;
      return ok(await treasuryImportService.commit(context, id));
    }),
);
