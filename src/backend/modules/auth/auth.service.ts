import bcrypt from "bcryptjs";

import { AppError } from "@/backend/core/errors";
import { logger } from "@/backend/core/logger";
import {
  assertNotRateLimited,
  recordFailure,
  recordSuccess,
} from "@/backend/core/rate-limit";
import type { RequestContext } from "@/backend/core/request-context";
import { userRepository } from "@/backend/modules/users/user.repository";
import type { AuthenticatedUser } from "@/shared/types";

import {
  PASSWORD_RESET_TTL_MS,
  SESSION_TTL_MS,
  SESSION_TTL_REMEMBER_MS,
} from "./auth.constants";
import type {
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
} from "./auth.schema";
import { passwordResetRepository } from "./password-reset.repository";
import { sessionRepository } from "./session.repository";

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 */

// bcrypt.compare için, "kullanıcı bulunamadı" durumunda bile SABİT MALİYETLİ
// bir hash karşılaştırması yapabilmek üzere üretilmiş, hiçbir gerçek şifreye
// ait OLMAYAN bir hash. Bu olmadan "var olmayan e-posta" ile "yanlış şifre"
// yanıt süresi farkından (timing attack) e-posta var mı diye anlaşılabilir.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing-safety", 10);

export interface LoginResult {
  user: AuthenticatedUser;
  sessionId: string;
  maxAgeSeconds: number;
}

export const authService = {
  async login(input: LoginInput): Promise<LoginResult> {
    const rateLimitKey = `login:${input.email.toLowerCase()}`;
    assertNotRateLimited(rateLimitKey);

    const credentials = await userRepository.findCredentialsByEmail(input.email);
    const passwordMatches = credentials
      ? await bcrypt.compare(input.password, credentials.passwordHash)
      : await bcrypt.compare(input.password, DUMMY_HASH);

    if (!credentials || !passwordMatches) {
      recordFailure(rateLimitKey);
      // Kasıtlı olarak GENEL mesaj: "e-posta yok" ile "şifre yanlış" ayrımı
      // yapılmaz — aksi hâlde kayıtlı e-postalar denenerek keşfedilebilir.
      throw new AppError("INVALID_CREDENTIALS", "E-posta veya şifre hatalı.", 401);
    }

    // ============================================================
    // MFA BURAYA EKLENECEK.
    // Parola doğrulandı ama oturum HENÜZ kurulmadı. İleride kullanıcının
    // MFA'sı aktifse, burada `sessionRepository.create(...)` çağrılmadan
    // önce bir doğrulama kodu üretilip { status: "MFA_REQUIRED", challengeId }
    // dönülür; asıl oturum sadece o kod doğrulandıktan SONRA (ikinci bir
    // servis fonksiyonunda, ör. `verifyMfaCode`) kurulur. Yani MFA, bu
    // fonksiyonun GÖVDESİNİ değiştirmez — tam bu noktada bir dallanma ekler.
    // ============================================================

    recordSuccess(rateLimitKey);

    const memberships = await userRepository.findMembershipsByUser(credentials.id);
    const primaryMembership = memberships[0];
    if (!primaryMembership) {
      throw new AppError(
        "NO_MEMBERSHIP",
        "Bu kullanıcının hiçbir kiracıda üyeliği yok.",
        403,
      );
    }

    const ttlMs = input.rememberMe ? SESSION_TTL_REMEMBER_MS : SESSION_TTL_MS;
    const session = await sessionRepository.create(
      credentials.id,
      primaryMembership.tenantId,
      ttlMs,
    );

    return {
      user: {
        id: credentials.id,
        name: credentials.name,
        email: credentials.email,
        tenantId: primaryMembership.tenantId,
        role: primaryMembership.role,
      },
      sessionId: session.id,
      maxAgeSeconds: Math.floor(ttlMs / 1000),
    };
  },

  async logout(sessionId: string | undefined): Promise<void> {
    if (sessionId) await sessionRepository.delete(sessionId);
  },

  /**
   * Session id -> RequestContext. Hem `backend/core/tenant.ts` (her API
   * isteğinde) hem `app/(app)/layout.tsx` (sayfa render'ında, server-side)
   * BUNU çağırır — tek doğruluk kaynağı.
   */
  async resolveSessionContext(
    sessionId: string | undefined,
  ): Promise<RequestContext | null> {
    if (!sessionId) return null;

    const session = await sessionRepository.find(sessionId);
    if (!session) return null;

    const [user, membership] = await Promise.all([
      userRepository.findById(session.userId),
      userRepository.findMembership(session.userId, session.tenantId),
    ]);
    if (!user || !membership) return null;

    // NOT: Burada BİLEREK `TenantContext.enterWith(...)` çağrılMIYOR. Bu
    // fonksiyon session/user/membership'i okumak için zaten `await` yapmış
    // durumda — deneyle doğrulandığı üzere (`tenant-context.ts`teki yorum)
    // bir `await`den SONRA çağrılan `enterWith`, bu fonksiyonu ÇAĞIRANA asla
    // yayılmıyor. Tenant bağlamı bunun yerine `tenant.ts`teki
    // `withTenantContext()` tarafından, dönen context `TenantContext.run()`a
    // verilerek kurulur — route handler'lar BUNU kullanmalı, bu fonksiyonu
    // doğrudan değil (bkz. o dosyadaki yorum).
    return {
      tenantId: session.tenantId,
      userId: user.id,
      userName: user.name,
      role: membership.role,
    };
  },

  async requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
    const credentials = await userRepository.findCredentialsByEmail(input.email);
    // Kullanıcı yoksa bile SESSİZCE başarı dön — bu uç, hangi e-postaların
    // sistemde kayıtlı olduğunu deneme-yanılmayla ortaya çıkarmaya (user
    // enumeration) izin vermemeli. Çağıran (route) her durumda aynı genel
    // mesajı döner.
    if (!credentials) return;

    const resetToken = await passwordResetRepository.create(
      credentials.id,
      PASSWORD_RESET_TTL_MS,
    );

    // Gerçek ortamda burada bir e-posta servisi (SES/SendGrid/…) çağrılır.
    // Bu demo'da e-posta altyapısı yok; bağlantıyı sunucu logunda görünür
    // kılıyoruz ki uçtan uca akış (link olmadan da) test edilebilsin.
    logger.info("Şifre sıfırlama bağlantısı üretildi", {
      userId: credentials.id,
      email: credentials.email,
      resetUrl: `/sifre-sifirla?token=${resetToken.token}`,
      expiresInMinutes: PASSWORD_RESET_TTL_MS / 60000,
    });
  },

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const record = await passwordResetRepository.find(input.token);
    if (!record) {
      throw new AppError(
        "INVALID_RESET_TOKEN",
        "Bağlantının süresi dolmuş ya da geçersiz. Yeniden sıfırlama isteyin.",
        422,
      );
    }

    const newHash = await bcrypt.hash(input.newPassword, 10);
    await userRepository.updatePasswordHash(record.userId, newHash);
    await passwordResetRepository.consume(input.token);
    // Şifre değiştiğinde tüm mevcut oturumlar geçersiz kılınır — biri şifreyi
    // sıfırlıyorsa (ör. hesap ele geçirilmişse), eski oturumların hâlâ açık
    // kalması güvenlik açığıdır.
    await sessionRepository.deleteAllForUser(record.userId);
  },
};
