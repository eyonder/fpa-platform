import { prisma } from "@/backend/core/prisma-client";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `PasswordResetToken` RLS'e TABİ DEĞİLDİR — bkz. `session.repository.ts`teki
 * not (aynı tenant-öncesi sorgulama gerekçesi).
 */

export interface PasswordResetToken {
  token: string;
  userId: string;
  expiresAt: number;
}

export const passwordResetRepository = {
  async create(userId: string, ttlMs: number): Promise<PasswordResetToken> {
    const expiresAt = Date.now() + ttlMs;
    const row = await prisma.passwordResetToken.create({
      data: { token: crypto.randomUUID(), userId, expiresAt: new Date(expiresAt) },
    });
    return { token: row.token, userId: row.userId, expiresAt: row.expiresAt.getTime() };
  },

  async find(token: string): Promise<PasswordResetToken | null> {
    const row = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) {
      await prisma.passwordResetToken.deleteMany({ where: { token } });
      return null;
    }
    return { token: row.token, userId: row.userId, expiresAt: row.expiresAt.getTime() };
  },

  async consume(token: string): Promise<void> {
    await prisma.passwordResetToken.deleteMany({ where: { token } });
  },
};
