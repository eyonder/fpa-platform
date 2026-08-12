import { handleRoute, ok } from "@/backend/core/http";
import { mfaVerifySchema } from "@/backend/modules/auth/auth.schema";
import { authService } from "@/backend/modules/auth/auth.service";
import { setSessionCookie } from "@/backend/modules/auth/set-session-cookie";

/**
 * İNCE CONTROLLER.
 * POST /api/auth/mfa/verify — { challengeId, code, rememberMe? }
 * `/api/auth/login`'in `MFA_REQUIRED` döndürdüğü akışın İKİNCİ adımı. Kod
 * (TOTP ya da yedek kod) doğrulanırsa oturum burada kurulur ve httpOnly
 * çerez set edilir — `/api/auth/login`'in başarı yolunun BİREBİR aynısı.
 */
export const POST = handleRoute(async (request: Request) => {
  const input = mfaVerifySchema.parse(await request.json());
  const result = await authService.verifyMfaAndCreateSession(
    input.challengeId,
    input.code,
    input.rememberMe,
  );

  const response = ok({ status: "OK" as const, user: result.user });
  setSessionCookie(response, result.sessionId, result.maxAgeSeconds);
  return response;
});
