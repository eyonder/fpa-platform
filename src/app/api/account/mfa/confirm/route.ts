import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { mfaEnrollConfirmSchema } from "@/backend/modules/auth/auth.schema";
import { mfaService } from "@/backend/modules/auth/mfa.service";

/**
 * İNCE CONTROLLER.
 * POST /api/account/mfa/confirm — { code } — enroll'u onaylar, MFA'yı
 * AKTİF eder, yedek kodları döner (SADECE BU ÇAĞRIDA — bir daha görüntülenemez).
 */
export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async ({ userId }) => {
    const input = mfaEnrollConfirmSchema.parse(await request.json());
    return ok(await mfaService.confirmEnrollment(userId, input.code));
  }),
);
