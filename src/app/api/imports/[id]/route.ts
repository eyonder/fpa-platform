import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { remapImportSchema } from "@/backend/modules/imports/import.schema";
import { importService } from "@/backend/modules/imports/import.service";

/**
 * İNCE CONTROLLER.
 * GET  /api/imports/:id       — batch'i getir (sihirbaz sayfası yenilenince).
 * PATCH /api/imports/:id      — kolon eşleştirmesini değiştir, önizlemeyi
 *                                yeniden hesapla (henüz bütçeye YAZMAZ).
 */
export const GET = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      const { id } = await routeContext.params;

      return ok(await importService.get(context, id));
    }),
);

export const PATCH = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "import:run");

      const { id } = await routeContext.params;
      const input = remapImportSchema.parse(await request.json());

      return ok(await importService.remap(context, id, input.mapping));
    }),
);
