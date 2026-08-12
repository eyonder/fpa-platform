import { prisma } from "@/backend/core/prisma-client";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `User.mfaSecretCiphertext`/`mfaEnabled`, `MfaBackupCode`, `MfaChallenge` —
 * ÜÇÜ DE RLS'e TABİ DEĞİL (bkz. `prisma/schema.prisma`), aynı
 * `session.repository.ts`/`password-reset.repository.ts` gerekçesiyle:
 * kimlik doğrulama sırasında (login, MFA doğrulama) henüz bir tenant bağlamı
 * yoktur.
 */

export interface MfaChallengeRecord {
  id: string;
  userId: string;
  expiresAt: number;
}

export const mfaRepository = {
  async getState(
    userId: string,
  ): Promise<{ enabled: boolean; secretCiphertext: string | null } | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, mfaSecretCiphertext: true },
    });
    return user
      ? { enabled: user.mfaEnabled, secretCiphertext: user.mfaSecretCiphertext }
      : null;
  },

  /** Enroll başlangıcı: sır kaydedilir ama `mfaEnabled` DEĞİŞMEZ (bkz. şemadaki not). */
  async savePendingSecret(userId: string, ciphertext: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { mfaSecretCiphertext: ciphertext },
    });
  },

  /** Enroll onayı: `mfaEnabled = true` yapar. */
  async activate(userId: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
  },

  /** Devre dışı bırakma: sır + bayrak + tüm yedek kodlar TEK transaction'da temizlenir. */
  async disableAndClear(userId: string): Promise<void> {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: false, mfaSecretCiphertext: null },
      }),
      prisma.mfaBackupCode.deleteMany({ where: { userId } }),
    ]);
  },

  async replaceBackupCodeHashes(userId: string, hashes: string[]): Promise<void> {
    const now = new Date();
    await prisma.$transaction([
      prisma.mfaBackupCode.deleteMany({ where: { userId } }),
      prisma.mfaBackupCode.createMany({
        data: hashes.map((codeHash) => ({
          id: crypto.randomUUID(),
          userId,
          codeHash,
          createdAt: now,
        })),
      }),
    ]);
  },

  async findUnusedBackupCodes(
    userId: string,
  ): Promise<{ id: string; codeHash: string }[]> {
    return prisma.mfaBackupCode.findMany({
      where: { userId, usedAt: null },
      select: { id: true, codeHash: true },
    });
  },

  async markBackupCodeUsed(id: string): Promise<void> {
    await prisma.mfaBackupCode.updateMany({
      where: { id },
      data: { usedAt: new Date() },
    });
  },

  async createChallenge(userId: string, ttlMs: number): Promise<MfaChallengeRecord> {
    const now = Date.now();
    const row = await prisma.mfaChallenge.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        createdAt: new Date(now),
        expiresAt: new Date(now + ttlMs),
      },
    });
    return { id: row.id, userId: row.userId, expiresAt: row.expiresAt.getTime() };
  },

  async findChallenge(id: string): Promise<MfaChallengeRecord | null> {
    const row = await prisma.mfaChallenge.findUnique({ where: { id } });
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) {
      await prisma.mfaChallenge.deleteMany({ where: { id } });
      return null;
    }
    return { id: row.id, userId: row.userId, expiresAt: row.expiresAt.getTime() };
  },

  async deleteChallenge(id: string): Promise<void> {
    await prisma.mfaChallenge.deleteMany({ where: { id } });
  },
};
