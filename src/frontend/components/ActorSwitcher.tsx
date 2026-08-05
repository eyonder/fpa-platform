"use client";

import { useSyncExternalStore } from "react";

import {
  DEFAULT_ACTOR,
  getActor,
  setActor,
  subscribeActor,
} from "@/frontend/lib/session-store";

/**
 * Gerçek auth eklenene kadar: RBAC'i arayüzden CANLI test edebilmek için
 * "kim olarak bağlanıyoruz" seçici. Liste, backend/modules/users/user.repository.ts
 * ile BİREBİR eşleşir — biri değişirse diğeri de güncellenmeli.
 */
const DEMO_ACTORS = [
  {
    userId: "user-demo-admin",
    tenantId: "demo-tenant",
    label: "Aylin Admin — Admin (demo-tenant)",
  },
  {
    userId: "user-demo-budget-manager",
    tenantId: "demo-tenant",
    label: "Barış Bütçe — Bütçe Yöneticisi (demo-tenant)",
  },
  {
    userId: "user-demo-data-entry",
    tenantId: "demo-tenant",
    label: "Deniz Data — Veri Giriş Uzmanı (demo-tenant)",
  },
  {
    userId: "user-holding-admin",
    tenantId: "org-holding",
    label: "Hale Holding — Admin (org-holding)",
  },
] as const;

function actorKey(userId: string, tenantId: string): string {
  return `${userId}::${tenantId}`;
}

export function ActorSwitcher() {
  const actor = useSyncExternalStore(subscribeActor, getActor, () => DEFAULT_ACTOR);
  const currentKey = actorKey(actor.userId, actor.tenantId);

  return (
    <select
      value={currentKey}
      onChange={(e) => {
        const [userId, tenantId] = e.target.value.split("::");
        setActor({ userId, tenantId });
        // Aktör değişince tüm ekranlar yeni rol/tenant'la yeniden veri
        // çeksin diye en basit ve sağlam yol: sayfayı tazelemek.
        window.location.reload();
      }}
      className="tabular ml-auto rounded-full border border-rule bg-ledger-soft px-3 py-1 text-xs text-ledger focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none"
      title="Demo: RBAC'i test etmek için farklı kullanıcı/rol seçin"
    >
      {DEMO_ACTORS.map((a) => (
        <option
          key={actorKey(a.userId, a.tenantId)}
          value={actorKey(a.userId, a.tenantId)}
        >
          {a.label}
        </option>
      ))}
    </select>
  );
}
