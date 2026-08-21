import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { mappingConfigService } from "@/backend/modules/treasury/mapping-config.service";
import { updateMappingConfigSchema } from "@/backend/modules/treasury/treasury.schema";

/**
 * İNCE CONTROLLER.
 * PATCH  /api/treasury/mappings/:id — kuralı düzenle.
 * DELETE /api/treasury/mappings/:id — kuralı sil.
 */
export const PATCH = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "treasury-mapping:write");
      const { id } = await routeContext.params;
      const input = updateMappingConfigSchema.parse(await request.json());
      return ok(await mappingConfigService.update(context, id, input));
    }),
);

export const DELETE = handleRoute(
  (request: Request, routeContext: { params: Promise<{ id: string }> }) =>
    withTenantContext(request, async (context) => {
      assertPermission(context.role, "treasury-mapping:write");
      const { id } = await routeContext.params;
      await mappingConfigService.delete(context, id);
      return ok({ deleted: true });
    }),
);
