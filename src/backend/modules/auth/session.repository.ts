import { getGlobalStore } from "@/backend/core/global-store";

/**
 * VERİ ERİŞİM KATMANI (Repository).
 *
 * Şu an bellekte sahte veri döner (bkz. scenario.repository.ts'teki not).
 * Prisma bağlandığında bu, bir `Session` tablosuna (ya da Redis'e) dönüşür —
 * tek sunucu örneğinin ötesine (yatay ölçekleme) geçildiğinde bellek-içi
 * Map paylaşılmaz, bu yüzden bu dosya erken değişecek adaylardan biridir.
 *
 * `getGlobalStore` KULLANIMI ZORUNLU (düz `new Map()` DEĞİL): bu repository
 * hem route handler'lardan (login/logout) hem server component'ten
 * ((app)/layout.tsx, get-current-user.ts üzerinden) çağrılıyor — bkz.
 * backend/core/global-store.ts'teki gerçek olay.
 */

export interface SessionRecord {
  id: string;
  userId: string;
  tenantId: string;
  createdAt: number;
  expiresAt: number;
}

const sessions = getGlobalStore(
  "auth-sessions",
  () => new Map<string, SessionRecord>(),
);

export const sessionRepository = {
  async create(
    userId: string,
    tenantId: string,
    ttlMs: number,
  ): Promise<SessionRecord> {
    const now = Date.now();
    const record: SessionRecord = {
      id: crypto.randomUUID(),
      userId,
      tenantId,
      createdAt: now,
      expiresAt: now + ttlMs,
    };
    sessions.set(record.id, record);
    return record;
  },

  async find(sessionId: string): Promise<SessionRecord | null> {
    const record = sessions.get(sessionId);
    if (!record) return null;
    if (record.expiresAt < Date.now()) {
      sessions.delete(sessionId);
      return null;
    }
    return record;
  },

  async delete(sessionId: string): Promise<void> {
    sessions.delete(sessionId);
  },

  /** Şifre değiştiğinde tüm oturumları düşürmek için (bkz. auth.service.ts resetPassword). */
  async deleteAllForUser(userId: string): Promise<void> {
    for (const [id, record] of sessions) {
      if (record.userId === userId) sessions.delete(id);
    }
  },
};
