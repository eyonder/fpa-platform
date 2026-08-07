import { handleRoute, ok } from "@/backend/core/http";
import { SESSION_COOKIE_NAME } from "@/backend/modules/auth/auth.constants";
import { authService } from "@/backend/modules/auth/auth.service";
import { readSessionCookie } from "@/backend/modules/auth/read-session-cookie";

/**
 * İNCE CONTROLLER.
 * POST /api/auth/logout — mevcut oturumu (varsa) sunucu tarafında siler ve
 * çerezi temizler. Oturum yoksa da (zaten çıkılmış) sessizce başarı döner.
 */
export const POST = handleRoute(async (request: Request) => {
  const sessionId = readSessionCookie(request);
  await authService.logout(sessionId);

  const response = ok({ loggedOut: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
});
