import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { salesStageConfigRepository } from "@/backend/modules/sales/sales-stage-config.repository";

/**
 * İNCE CONTROLLER.
 * GET /api/sales-stage-config — küresel aşama -> varsayılan kazanma
 * olasılığı tablosu (bkz. vuk-amortisman-config/route.ts ile AYNI gerekçe:
 * arayüz, kullanıcı göndermeden ÖNCE geçerli olasılığı göstermek zorunda).
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async () => {
    return ok(await salesStageConfigRepository.findAll());
  }),
);
