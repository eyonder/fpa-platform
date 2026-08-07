import { handleRoute, ok } from "@/backend/core/http";
import { resetPasswordSchema } from "@/backend/modules/auth/auth.schema";
import { authService } from "@/backend/modules/auth/auth.service";

/**
 * İNCE CONTROLLER.
 * POST /api/auth/reset-password — { token, newPassword }
 * Geçersiz/süresi dolmuş token -> 422. Başarılıysa şifre güncellenir ve
 * kullanıcının TÜM oturumları düşürülür (bkz. auth.service.ts).
 */
export const POST = handleRoute(async (request: Request) => {
  const input = resetPasswordSchema.parse(await request.json());
  await authService.resetPassword(input);

  return ok({ message: "Şifreniz güncellendi. Şimdi giriş yapabilirsiniz." });
});
