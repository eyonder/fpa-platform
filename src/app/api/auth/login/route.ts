import { handleRoute, ok } from "@/backend/core/http";
import { loginSchema } from "@/backend/modules/auth/auth.schema";
import { authService } from "@/backend/modules/auth/auth.service";
import { setSessionCookie } from "@/backend/modules/auth/set-session-cookie";

/**
 * İNCE CONTROLLER.
 * POST /api/auth/login — { email, password, rememberMe? }
 * İki sonuç mümkün: `{status:"OK", user}` (httpOnly oturum çerezi set edilir)
 * ya da kullanıcının MFA'sı aktifse `{status:"MFA_REQUIRED", challengeId}`
 * (çerez set EDİLMEZ — oturum sadece /api/auth/mfa/verify sonrası kurulur).
 * Buraya asla iş mantığı (if/else hesap kuralı) yazılmaz.
 */
export const POST = handleRoute(async (request: Request) => {
  const input = loginSchema.parse(await request.json());
  const outcome = await authService.login(input);

  if (outcome.status === "MFA_REQUIRED") {
    return ok(outcome);
  }

  const response = ok({ status: "OK" as const, user: outcome.user });
  setSessionCookie(response, outcome.sessionId, outcome.maxAgeSeconds);
  return response;
});
