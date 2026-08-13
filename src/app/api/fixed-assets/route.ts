import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { fixedAssetService } from "@/backend/modules/fixed-assets/fixed-asset.service";
import {
  createFixedAssetSchema,
  listFixedAssetsSchema,
} from "@/backend/modules/fixed-assets/fixed-asset.schema";

/**
 * İNCE CONTROLLER.
 * GET  /api/fixed-assets?category=&status= — listele/filtrele.
 * POST /api/fixed-assets — yeni TASLAK sabit kıymet.
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async ({ tenantId }) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const query = listFixedAssetsSchema.parse(params);
    return ok(await fixedAssetService.list(tenantId, query));
  }),
);

export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async ({ tenantId, role }) => {
    assertPermission(role, "fixed-asset:write");
    const input = createFixedAssetSchema.parse(await request.json());
    return ok(await fixedAssetService.create(tenantId, input), 201);
  }),
);
