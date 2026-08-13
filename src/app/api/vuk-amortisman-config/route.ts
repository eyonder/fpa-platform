import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { vukAmortismanConfigRepository } from "@/backend/modules/fixed-assets/vuk-amortisman-config.repository";

/**
 * İNCE CONTROLLER.
 * GET /api/vuk-amortisman-config — küresel VUK amortisman oran tablosu
 * (kategori seçim listesini doldurmak için). `PayrollTaxConfig`'in AKSİNE
 * (o hiç route almadı, sadece seed) buna bilerek bir GET route eklendi —
 * arayüz, kullanıcı göndermeden ÖNCE geçerli oranı göstermek zorunda.
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async () => {
    return ok(await vukAmortismanConfigRepository.findAll());
  }),
);
