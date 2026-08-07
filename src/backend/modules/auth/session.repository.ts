import { prisma } from "@/backend/core/prisma-client";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `Session` RLS'e TABİ DEĞİLDİR (bkz. `prisma/schema.prisma`) — bu
 * repository henüz tenant bağlamı kurulmadan ÖNCE sorgulanır (login,
 * `getRequestContext`/`get-current-user.ts`'nin session çözümlemesi).
 *
 * `createdAt`/`expiresAt` bu sözleşmede (ve `auth.constants.ts`'teki TTL
 * hesaplarında) epoch-ms `number` olarak tutulur — DB'de `DateTime`, bu
 * yüzden sınırda (boundary) `Date` ↔ `number` çevrimi burada yapılır.
 */

export interface SessionRecord {
  id: string;
  userId: string;
  tenantId: string;
  createdAt: number;
  expiresAt: number;
}

function toSessionRecord(row: {
  id: string;
  userId: string;
  tenantId: string;
  createdAt: Date;
  expiresAt: Date;
}): SessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    tenantId: row.tenantId,
    createdAt: row.createdAt.getTime(),
    expiresAt: row.expiresAt.getTime(),
  };
}

export const sessionRepository = {
  async create(
    userId: string,
    tenantId: string,
    ttlMs: number,
  ): Promise<SessionRecord> {
    const now = Date.now();
    const row = await prisma.session.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        tenantId,
        createdAt: new Date(now),
        expiresAt: new Date(now + ttlMs),
      },
    });
    return toSessionRecord(row);
  },

  async find(sessionId: string): Promise<SessionRecord | null> {
    const row = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) {
      await prisma.session.deleteMany({ where: { id: sessionId } });
      return null;
    }
    return toSessionRecord(row);
  },

  async delete(sessionId: string): Promise<void> {
    // `deleteMany` KASITLI: kayıt yoksa sessizce hiçbir şey yapmaz (`delete`
    // olmayan bir id için P2025 fırlatır) — eski Map.delete davranışıyla aynı.
    await prisma.session.deleteMany({ where: { id: sessionId } });
  },

  /** Şifre değiştiğinde tüm oturumları düşürmek için (bkz. auth.service.ts resetPassword). */
  async deleteAllForUser(userId: string): Promise<void> {
    await prisma.session.deleteMany({ where: { userId } });
  },
};
