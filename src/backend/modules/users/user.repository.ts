import { prisma } from "@/backend/core/prisma-client";
import type { Membership, User } from "@/shared/types";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `User`/`Membership` RLS'e TABİ DEĞİLDİR (bkz. `prisma/schema.prisma`) —
 * login akışı, tenant bilinmeden ÖNCE bu tabloları sorgular (bkz.
 * `auth.service.ts`'teki `resolveSessionContext`).
 *
 * ÖNEMLİ: `passwordHash` HİÇBİR ZAMAN dışa (route/frontend) sızmaz —
 * `findById`/`findByEmail` her zaman `toPublicUser` ile temizlenmiş `User`
 * döner. Şifre doğrulaması gereken TEK yer olan `auth.service.ts`,
 * `findCredentialsByEmail` ile ham kaydı okur.
 */

export interface UserRecord extends User {
  passwordHash: string;
}

function toPublicUser(record: { id: string; name: string; email: string }): User {
  return { id: record.id, name: record.name, email: record.email };
}

export const userRepository = {
  async findById(userId: string): Promise<User | null> {
    const record = await prisma.user.findUnique({ where: { id: userId } });
    return record ? toPublicUser(record) : null;
  },

  async findByEmail(email: string): Promise<User | null> {
    const record = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    return record ? toPublicUser(record) : null;
  },

  /** Şifre doğrulaması İÇİNDİR — passwordHash döner. Sadece auth.service.ts çağırmalı. */
  async findCredentialsByEmail(email: string): Promise<UserRecord | null> {
    const record = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    return record ?? null;
  },

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    // `updateMany` KASITLI: kayıt yoksa (olması beklenmez ama) sessizce
    // hiçbir şey yapmaz — eski bellek-içi repository'nin davranışıyla aynı.
    await prisma.user.updateMany({ where: { id: userId }, data: { passwordHash } });
  },

  async findMembership(userId: string, tenantId: string): Promise<Membership | null> {
    const record = await prisma.membership.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
    });
    return record
      ? { userId: record.userId, tenantId: record.tenantId, role: record.role }
      : null;
  },

  /** Bir kullanıcının üye olduğu tüm tenant'lar — login'de "birincil" tenant'ı seçmek için. */
  async findMembershipsByUser(userId: string): Promise<Membership[]> {
    // `ORDER BY id ASC`: Postgres `findMany` aksi belirtilmedikçe sıralama
    // GARANTİSİ vermez — "ilk üyelik = birincil tenant" mantığının
    // (authService.login) deterministik kalması için şart. `id` sadece
    // dahili sıralama içindir, domain tipinde (Membership) yoktur — bkz.
    // prisma/schema.prisma'daki Membership modelinin yorumu.
    const records = await prisma.membership.findMany({
      where: { userId },
      orderBy: { id: "asc" },
    });
    return records.map((r) => ({
      userId: r.userId,
      tenantId: r.tenantId,
      role: r.role,
    }));
  },
};
