import type { Membership, User } from "@/shared/types";

/**
 * VERİ ERİŞİM KATMANI (Repository).
 *
 * Şu an bellekte sahte veri döner (bkz. scenario.repository.ts'teki not).
 * Gerçek auth (NextAuth/Clerk/kendi JWT'niz) eklendiğinde SADECE bu dosya
 * (ve tenant.ts'teki çözümleme) değişir; authorize.ts ve route'lar aynı kalır.
 *
 * Demo kullanıcıları, frontend/components/ActorSwitcher.tsx'teki listeyle
 * BİREBİR eşleşir — RBAC'i arayüzden canlı test edebilmek için.
 */

const USERS: User[] = [
  { id: "user-demo-admin", name: "Aylin Admin", email: "aylin@demo-tenant.test" },
  {
    id: "user-demo-budget-manager",
    name: "Barış Bütçe",
    email: "baris@demo-tenant.test",
  },
  { id: "user-demo-data-entry", name: "Deniz Data", email: "deniz@demo-tenant.test" },
  { id: "user-holding-admin", name: "Hale Holding", email: "hale@org-holding.test" },
];

const MEMBERSHIPS: Membership[] = [
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

const usersById = new Map(USERS.map((u) => [u.id, u]));

export const userRepository = {
  async findById(userId: string): Promise<User | null> {
    return usersById.get(userId) ?? null;
  },

  async findMembership(userId: string, tenantId: string): Promise<Membership | null> {
    return (
      MEMBERSHIPS.find((m) => m.userId === userId && m.tenantId === tenantId) ?? null
    );
  },
};
