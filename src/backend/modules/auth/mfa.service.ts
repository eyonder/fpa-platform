import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

import { decrypt, encrypt } from "@/backend/core/crypto";
import { sendEmail } from "@/backend/core/email";
import { AppError, NotFoundError } from "@/backend/core/errors";
import {
  assertNotRateLimited,
  recordFailure,
  recordSuccess,
} from "@/backend/core/rate-limit";
import { userRepository } from "@/backend/modules/users/user.repository";

import { MFA_BACKUP_CODE_COUNT, MFA_CHALLENGE_TTL_MS } from "./auth.constants";
import { mfaRepository } from "./mfa.repository";

/**
 * İŞ MANTIĞI KATMANI (Service) — TOTP MFA.
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * Enroll akışı İKİ adımdır (backup-kodların TEK SEFERLİK gösterilebilmesi
 * için doğrulama şart):
 *   1. `generateEnrollment` — yeni bir sır üretir, ŞİFRELİ olarak
 *      `User.mfaSecretCiphertext`'e yazar ama `mfaEnabled` HÂLÂ false'tur
 *      (bkz. schema.prisma'daki not) — kullanıcı QR'ı okutup bir kod
 *      girene kadar bu sır İNERT'tir, login akışını ETKİLEMEZ.
 *   2. `confirmEnrollment` — girilen kodu doğrular, `mfaEnabled = true`
 *      yapar, yedek kodları üretip HASH'lenmiş olarak saklar, DÜZ METİN
 *      kodları SADECE BU ÇAĞRIDA döner (bir daha asla görüntülenemez).
 */

const ISSUER = "FP&A Platform";

function generateBackupCode(): string {
  // 5 byte -> 10 hex karakter -> "XXXXX-XXXXX" biçiminde, okunması/elle
  // girilmesi kolay ama TOTP kodundan (6 hane) AÇIKÇA ayırt edilebilir.
  const raw = randomBytes(5).toString("hex").toUpperCase();
  return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
}

/**
 * `otplib`'in `verify()`'ı, beklenen uzunlukta (6 hane) OLMAYAN bir token
 * için `{valid:false}` DEĞİL, `TokenLengthError` FIRLATIR — bir yedek kodu
 * ("XXXXX-XXXXX") buraya geçirmek (ki `verifyChallenge` TOTP'yi ÖNCE dener)
 * bu yüzden istisnasız çökerdi. Burada yutulup `{valid:false}`e çevrilir;
 * çağıran zaten TOTP başarısız olursa yedek koda bakıyor.
 */
async function tryVerifyTotp(secret: string, token: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token });
    return result.valid;
  } catch {
    return false;
  }
}

export const mfaService = {
  async getStatus(userId: string): Promise<{ enabled: boolean }> {
    const state = await mfaRepository.getState(userId);
    return { enabled: state?.enabled ?? false };
  },

  async generateEnrollment(
    userId: string,
  ): Promise<{ otpauthUrl: string; qrCodeDataUrl: string; secret: string }> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError("Kullanıcı");

    const secret = generateSecret();
    await mfaRepository.savePendingSecret(userId, encrypt(secret));

    const otpauthUrl = generateURI({ issuer: ISSUER, label: user.email, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return { otpauthUrl, qrCodeDataUrl, secret };
  },

  async confirmEnrollment(
    userId: string,
    code: string,
  ): Promise<{ backupCodes: string[] }> {
    const state = await mfaRepository.getState(userId);
    if (!state?.secretCiphertext) {
      throw new AppError(
        "MFA_ENROLLMENT_NOT_STARTED",
        "Önce QR kodu okutup bir sır üretmelisiniz.",
        409,
      );
    }

    const secret = decrypt(state.secretCiphertext);
    if (!(await tryVerifyTotp(secret, code))) {
      throw new AppError("INVALID_MFA_CODE", "Kod doğrulanamadı. Tekrar deneyin.", 422);
    }

    await mfaRepository.activate(userId);

    const backupCodes = Array.from(
      { length: MFA_BACKUP_CODE_COUNT },
      generateBackupCode,
    );
    const hashes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));
    await mfaRepository.replaceBackupCodeHashes(userId, hashes);

    const user = await userRepository.findById(userId);
    if (user) {
      await sendEmail({
        to: user.email,
        subject: "İki faktörlü doğrulama etkinleştirildi",
        html: `<p>Merhaba ${user.name},</p><p>Hesabınızda iki faktörlü doğrulama (MFA) etkinleştirildi. Bunu siz yapmadıysanız lütfen hemen şifrenizi değiştirin.</p>`,
      });
    }

    return { backupCodes };
  },

  async disable(userId: string): Promise<void> {
    await mfaRepository.disableAndClear(userId);

    const user = await userRepository.findById(userId);
    if (user) {
      await sendEmail({
        to: user.email,
        subject: "İki faktörlü doğrulama devre dışı bırakıldı",
        html: `<p>Merhaba ${user.name},</p><p>Hesabınızda iki faktörlü doğrulama (MFA) devre dışı bırakıldı. Bunu siz yapmadıysanız lütfen hemen şifrenizi değiştirin.</p>`,
      });
    }
  },

  async createChallengeForUser(userId: string): Promise<string> {
    const challenge = await mfaRepository.createChallenge(userId, MFA_CHALLENGE_TTL_MS);
    return challenge.id;
  },

  /** Doğrulanırsa userId döner (session kurmak `auth.service.ts`'in işi); yoksa AppError fırlatır. */
  async verifyChallenge(challengeId: string, code: string): Promise<string> {
    const rateLimitKey = `mfa:${challengeId}`;
    assertNotRateLimited(rateLimitKey);

    const challenge = await mfaRepository.findChallenge(challengeId);
    if (!challenge) {
      throw new AppError(
        "MFA_CHALLENGE_EXPIRED",
        "Doğrulama isteğinin süresi doldu. Lütfen tekrar giriş yapın.",
        401,
      );
    }

    const state = await mfaRepository.getState(challenge.userId);
    if (!state?.enabled || !state.secretCiphertext) {
      // Beklenmedik durum (ör. challenge oluşturulduktan sonra MFA disable
      // edildi) — güvenli taraf: reddet, çağıran yeniden login dener.
      recordFailure(rateLimitKey);
      throw new AppError("INVALID_MFA_CODE", "Kod doğrulanamadı.", 422);
    }

    const secret = decrypt(state.secretCiphertext);

    if (await tryVerifyTotp(secret, code)) {
      recordSuccess(rateLimitKey);
      await mfaRepository.deleteChallenge(challengeId);
      return challenge.userId;
    }

    // TOTP eşleşmedi — yedek kod olabilir mi diye bak.
    const unusedCodes = await mfaRepository.findUnusedBackupCodes(challenge.userId);
    for (const backupCode of unusedCodes) {
      if (await bcrypt.compare(code, backupCode.codeHash)) {
        recordSuccess(rateLimitKey);
        await mfaRepository.markBackupCodeUsed(backupCode.id);
        await mfaRepository.deleteChallenge(challengeId);
        return challenge.userId;
      }
    }

    recordFailure(rateLimitKey);
    throw new AppError("INVALID_MFA_CODE", "Kod doğrulanamadı. Tekrar deneyin.", 422);
  },
};
