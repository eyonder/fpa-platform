import { AppError } from "@/backend/core/errors";
import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { mfaDisableSchema } from "@/backend/modules/auth/auth.schema";
import { authService } from "@/backend/modules/auth/auth.service";
import { mfaService } from "@/backend/modules/auth/mfa.service";

/**
 * İNCE CONTROLLER.
 * POST /api/account/mfa/disable — { password } — hassas bir işlem olduğu
 * için şifre yeniden istenir (oturum çerezi tek başına yeterli sayılmaz).
 */
export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async ({ userId }) => {
    const input = mfaDisableSchema.parse(await request.json());

    const passwordOk = await authService.verifyPassword(userId, input.password);
    if (!passwordOk) {
      throw new AppError("INVALID_CREDENTIALS", "Şifre hatalı.", 401);
    }

    await mfaService.disable(userId);
    return ok({ disabled: true });
  }),
);
