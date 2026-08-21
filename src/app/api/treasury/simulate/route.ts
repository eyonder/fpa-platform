import { assertPermission } from "@/backend/core/authorize";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { treasuryProjectionService } from "@/backend/modules/treasury/treasury-projection.service";
import { treasurySimulationSchema } from "@/backend/modules/treasury/treasury-simulation.schema";

/**
 * İNCE CONTROLLER.
 * POST /api/treasury/simulate — What-If.
 *
 * EPHEMERAL: hiçbir şey YAZMAZ, hiçbir şey SAKLAMAZ; yeniden hesaplanmış bir
 * projeksiyon döner (kullanıcıyla teyit edilmiş mimari karar — kayıtlı
 * simülasyon CRUD'u MVP dışıdır). GET DEĞİL POST: gövdede düzeltme listesi
 * taşınır ve istek sunucuda gerçek bir hesaplama başlatır.
 */
export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async (context) => {
    assertPermission(context.role, "treasury-simulation:run");
    const input = treasurySimulationSchema.parse(await request.json());
    return ok(
      await treasuryProjectionService.project(context, {
        ...input,
        includeDerived: input.includeDerived,
        adjustments: input.adjustments,
      }),
    );
  }),
);
