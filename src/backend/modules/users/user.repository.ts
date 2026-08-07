import bcrypt from "bcryptjs";

import { getGlobalStore } from "@/backend/core/global-store";
import type { Membership, User } from "@/shared/types";

/**
 * VERİ ERİŞİM KATMANI (Repository).
 *
 * Şu an bellekte sahte veri döner (bkz. scenario.repository.ts'teki not).
 * Gerçek auth (NextAuth/Clerk/kendi JWT'niz) eklendiğinde SADECE bu dosya
 * (ve auth.service.ts'teki çözümleme) değişir; authorize.ts ve route'lar aynı kalır.
 *
 * Demo kullanıcıları, frontend/screens/auth/LoginScreen.tsx'teki listeyle
 * BİREBİR eşleşir — giriş ekranını canlı test edebilmek için.
 *
 * ÖNEMLİ: `passwordHash` HİÇBİR ZAMAN dışa (route/frontend) sızmaz —
 * `findById`/`findByEmail` her zaman `toPublicUser` ile temizlenmiş `User`
 * döner. Şifre doğrulaması gereken TEK yer olan `auth.service.ts`,
 * `findCredentialsByEmail` ile ham kaydı okur.
 *
 * `getGlobalStore` KULLANIMI ZORUNLU (düz modül-seviyesi `new Map()` DEĞİL):
 * bu repository hem route handler'lardan hem server component'ten
 * ((app)/layout.tsx, get-current-user.ts üzerinden) çağrılıyor — bkz.
 * backend/core/global-store.ts'teki gerçek olay. Aksi hâlde ör.
 * `updatePasswordHash` bir pakette yazar, diğer pakette hiç görünmez.
 */

interface UserRecord extends User {
  passwordHash: string;
}

interface UserStore {
  usersById: Map<string, UserRecord>;
  memberships: Membership[];
}

function createUserStore(): UserStore {
  // Demo amaçlı: tüm demo kullanıcıları AYNI şifreyi kullanır, sadece bu
  // dosyada hash'lenir (düz metin hiçbir yerde saklanmaz). Gerçek üretimde
  // kullanıcılar kendi şifrelerini seçer.
  const DEMO_PASSWORD = "Demo1234!";
  const DEMO_PASSWORD_HASH = bcrypt.hashSync(DEMO_PASSWORD, 10);

  const users: UserRecord[] = [
    {
      id: "user-demo-admin",
      name: "Aylin Admin",
      email: "aylin@demo-tenant.test",
      passwordHash: DEMO_PASSWORD_HASH,
    },
    {
      id: "user-demo-budget-manager",
      name: "Barış Bütçe",
      email: "baris@demo-tenant.test",
      passwordHash: DEMO_PASSWORD_HASH,
    },
    {
      id: "user-demo-data-entry",
      name: "Deniz Data",
      email: "deniz@demo-tenant.test",
      passwordHash: DEMO_PASSWORD_HASH,
    },
    {
      id: "user-holding-admin",
      name: "Hale Holding",
      email: "hale@org-holding.test",
      passwordHash: DEMO_PASSWORD_HASH,
    },
  ];

  const memberships: Membership[] = [
    { userId: "user-demo-admin", tenantId: "demo-tenant", role: "ADMIN" },
    {
      userId: "user-demo-budget-manager",
      tenantId: "demo-tenant",
      role: "BUDGET_MANAGER",
    },
    { userId: "user-demo-data-entry", tenantId: "demo-tenant", role: "DATA_ENTRY" },

    { userId: "user-holding-admin", tenantId: "org-holding", role: "ADMIN" },
    // Holding admin'i, konsolidasyon demo'sunun alt şirketlerinde de (pratiklik için) admin.
    { userId: "user-holding-admin", tenantId: "org-tr", role: "ADMIN" },
    { userId: "user-holding-admin", tenantId: "org-de", role: "ADMIN" },
    { userId: "user-holding-admin", tenantId: "org-us", role: "ADMIN" },
  ];

  return { usersById: new Map(users.map((u) => [u.id, u])), memberships };
}

const { usersById, memberships } = getGlobalStore("users", createUserStore);

function toPublicUser(record: UserRecord): User {
  return { id: record.id, name: record.name, email: record.email };
}

export const userRepository = {
  async findById(userId: string): Promise<User | null> {
    const record = usersById.get(userId);
    return record ? toPublicUser(record) : null;
  },

  async findByEmail(email: string): Promise<User | null> {
    const record = [...usersById.values()].find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
    return record ? toPublicUser(record) : null;
  },

  /** Şifre doğrulaması İÇİNDİR — passwordHash döner. Sadece auth.service.ts çağırmalı. */
  async findCredentialsByEmail(email: string): Promise<UserRecord | null> {
    return (
      [...usersById.values()].find(
        (u) => u.email.toLowerCase() === email.toLowerCase(),
      ) ?? null
    );
  },

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    const record = usersById.get(userId);
    if (record) record.passwordHash = passwordHash;
  },

  async findMembership(userId: string, tenantId: string): Promise<Membership | null> {
    return (
      memberships.find((m) => m.userId === userId && m.tenantId === tenantId) ?? null
    );
  },

  /** Bir kullanıcının üye olduğu tüm tenant'lar — login'de "birincil" tenant'ı seçmek için. */
  async findMembershipsByUser(userId: string): Promise<Membership[]> {
    return memberships.filter((m) => m.userId === userId);
  },
};
