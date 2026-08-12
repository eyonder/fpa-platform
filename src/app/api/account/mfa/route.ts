import { handleRoute, ok } from "@/backend/core/http";
import { withTenantContext } from "@/backend/core/tenant";
import { mfaService } from "@/backend/modules/auth/mfa.service";

/**
 * İNCE CONTROLLER.
 * GET  /api/account/mfa — { enabled } — mevcut kullanıcının MFA durumu.
 * POST /api/account/mfa — enroll BAŞLATIR: yeni bir sır üretir (henüz
 *   AKTİF DEĞİL — bkz. mfa.service.ts), QR kod + manuel giriş sırrını döner.
 * `withTenantContext` kullanılır (User/MfaChallenge/MfaBackupCode RLS'e tabi
 * OLMASA da, isteği yapan KİM'i bilmek için oturum çözümü hâlâ gerekir).
 */
export const GET = handleRoute((request: Request) =>
  withTenantContext(request, async ({ userId }) =>
    ok(await mfaService.getStatus(userId)),
  ),
);

export const POST = handleRoute((request: Request) =>
  withTenantContext(request, async ({ userId }) =>
    ok(await mfaService.generateEnrollment(userId)),
  ),
);
