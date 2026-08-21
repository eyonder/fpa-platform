import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { remapTreasuryImportSchema } from "@/backend/modules/treasury/treasury-import.schema";
import { treasuryImportService } from "@/backend/modules/treasury/treasury-import.service";

/**
 * İNCE CONTROLLER.
 * GET   /api/treasury/imports/:id — batch'i getir (sihirbaz sayfası yenilenince).
 * PATCH /api/treasury/imports/:id — kolon eşleştirmesini değiştir, önizlemeyi
 *                                    yeniden hesapla (henüz CashFlowEvent YAZMAZ).
 */
export const GET = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      const { id } = await routeContext.params;
      return ok(await treasuryImportService.get(context, id));
    }),
);

export const PATCH = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "treasury-event:write");
      const { id } = await routeContext.params;
      const input = remapTreasuryImportSchema.parse(await request.json());
      return ok(await treasuryImportService.remap(context, id, input.mapping));
    }),
);
