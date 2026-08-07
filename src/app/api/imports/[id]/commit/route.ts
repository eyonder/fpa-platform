import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { importService } from "@/backend/modules/imports/import.service";

/**
 * İNCE CONTROLLER.
 * POST /api/imports/:id/commit — geçerli satırları bütçeye yazar (kilit
 * kontrolü + audit kaydı budgetLineService.bulkUpsert üzerinden gelir).
 */
export const POST = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "import:run");

      const { id } = await routeContext.params;

      return ok(await importService.commit(context, id));
    }),
);
