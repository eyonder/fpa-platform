import { handleRoute, ok } from "@/backend/core/http";
import { forgotPasswordSchema } from "@/backend/modules/auth/auth.schema";
import { authService } from "@/backend/modules/auth/auth.service";

/**
 * İNCE CONTROLLER.
 * POST /api/auth/forgot-password — { email }
 * Kasıtlı olarak e-posta kayıtlı olsun ya da olmasın AYNI genel mesajı döner
 * (bkz. auth.service.ts) — user enumeration'a izin vermemek için.
 */
export const POST = handleRoute(async (request: Request) => {
  const input = forgotPasswordSchema.parse(await request.json());
  await authService.requestPasswordReset(input);

  return ok({
    message: "Bu e-posta sistemde kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.",
  });
});
