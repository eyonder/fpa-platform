import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { mappingConfigService } from "@/backend/modules/treasury/mapping-config.service";

/**
 * İNCE CONTROLLER.
 * POST /api/treasury/mappings/seed-defaults — "Varsayılan THP setini yükle".
 * Zaten var olan (tenantId, accountCode) çiftlerini sessizce atlar — tekrar
 * tıklamak hata VERMEZ (bkz. mapping-config.repository.ts#seedDefaults).
 */
export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "treasury-mapping:write");
    return ok(await mappingConfigService.seedDefaults(context));
  }),
);
