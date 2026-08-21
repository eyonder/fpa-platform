import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { mappingConfigService } from "@/backend/modules/treasury/mapping-config.service";
import { createMappingConfigSchema } from "@/backend/modules/treasury/treasury.schema";

/**
 * İNCE CONTROLLER.
 * GET  /api/treasury/mappings — THP kod -> kategori eşleştirme kurallarının tümü.
 * POST /api/treasury/mappings — yeni kural.
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async ({ tenantId }) => {
    return ok(await mappingConfigService.list(tenantId));
  }),
);

export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "treasury-mapping:write");
    const input = createMappingConfigSchema.parse(await request.json());
    return ok(await mappingConfigService.create(context, input), 201);
  }),
);
