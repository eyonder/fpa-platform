import { handleRoute, ok } from "@/backend/core/http";
import { SESSION_COOKIE_NAME } from "@/backend/modules/auth/auth.constants";
import { loginSchema } from "@/backend/modules/auth/auth.schema";
import { authService } from "@/backend/modules/auth/auth.service";

/**
 * İNCE CONTROLLER.
 * POST /api/auth/login — { email, password, rememberMe? }
 * Başarılıysa httpOnly oturum çerezi set eder ve AuthenticatedUser döner.
 * Buraya asla iş mantığı (if/else hesap kuralı) yazılmaz.
 */
export const POST = handleRoute(async (request: Request) => {
  const input = loginSchema.parse(await request.json());
  const result = await authService.login(input);

  const response = ok(result.user);
  response.cookies.set(SESSION_COOKIE_NAME, result.sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: result.maxAgeSeconds,
  });
  return response;
});
