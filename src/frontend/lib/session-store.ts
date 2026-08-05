"use client";

/**
 * Gerçek auth (NextAuth/Clerk) gelene kadar: "hangi kullanıcı olarak
 * bağlanıyoruz" demo amaçlı burada tutulur ve api-client.ts tarafından her
 * isteğe x-tenant-id/x-user-id header'ı olarak eklenir (bkz. backend/core/tenant.ts).
 *
 * React context YERİNE düz modül-seviyesi state + subscriber listesi
 * kullanıyoruz çünkü api-client.ts bir React bileşeni değil — hook'suz,
 * senkron biçimde "şu an kim bağlı" bilgisine erişebilmesi gerekiyor.
 * ActorSwitcher.tsx, useSyncExternalStore ile buna abone olur.
 */

export interface Actor {
  tenantId: string;
  userId: string;
}

export const DEFAULT_ACTOR: Actor = {
  tenantId: "demo-tenant",
  userId: "user-demo-admin",
};

const STORAGE_KEY = "fpa.actor";

let currentActor: Actor = DEFAULT_ACTOR;
const listeners = new Set<() => void>();

function readPersisted(): Actor | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "tenantId" in parsed &&
      "userId" in parsed &&
      typeof (parsed as Actor).tenantId === "string" &&
      typeof (parsed as Actor).userId === "string"
    ) {
      return parsed as Actor;
    }
  } catch {
    /* bozuk kayıt -> yoksay, varsayılana dön */
  }
  return null;
}

// Modül ilk yüklendiğinde (client'ta) kalıcı seçim varsa onu kullan.
currentActor = readPersisted() ?? DEFAULT_ACTOR;

export function getActor(): Actor {
  return currentActor;
}

export function setActor(actor: Actor): void {
  currentActor = actor;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(actor));
  }
  listeners.forEach((listener) => listener());
}

export function subscribeActor(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
