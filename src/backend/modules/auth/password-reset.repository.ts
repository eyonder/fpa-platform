import { getGlobalStore } from "@/backend/core/global-store";

/**
 * VERİ ERİŞİM KATMANI (Repository).
 *
 * Şu an bellekte sahte veri döner (bkz. scenario.repository.ts'teki not).
 * `getGlobalStore` kullanımı için bkz. session.repository.ts'teki not.
 */

export interface PasswordResetToken {
  token: string;
  userId: string;
  expiresAt: number;
}

const tokens = getGlobalStore(
  "password-reset-tokens",
  () => new Map<string, PasswordResetToken>(),
);

export const passwordResetRepository = {
  async create(userId: string, ttlMs: number): Promise<PasswordResetToken> {
    const record: PasswordResetToken = {
      token: crypto.randomUUID(),
      userId,
      expiresAt: Date.now() + ttlMs,
    };
    tokens.set(record.token, record);
    return record;
  },

  async find(token: string): Promise<PasswordResetToken | null> {
    const record = tokens.get(token);
    if (!record) return null;
    if (record.expiresAt < Date.now()) {
      tokens.delete(token);
      return null;
    }
    return record;
  },

  async consume(token: string): Promise<void> {
    tokens.delete(token);
  },
};
