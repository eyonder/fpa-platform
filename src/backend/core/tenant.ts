import { userRepository } from "@/backend/modules/users/user.repository";
import type { Role } from "@/shared/types";

import { ForbiddenError } from "./errors";

export interface RequestContext {
  tenantId: string;
  userId: string;
  userName: string;
  role: Role;
}

/**
 * İstek bağlamını çözer: hem tenant (x-tenant-id) hem KULLANICI (x-user-id).
 *
 * Gerçek auth (NextAuth/Clerk/kendi JWT'niz) eklendiğinde SADECE bu fonksiyonun
 * gövdesi değişir (header yerine session/token'dan okunur). Tüm route'lar
 * zaten buradan geçtiği için hem tenant izolasyonu hem RBAC tek noktadan
 * kontrol edilir. Header'lar frontend/lib/session-store.ts tarafından
 * (ActorSwitcher ile seçilen demo kullanıcıya göre) otomatik eklenir.
 */
export async function getRequestContext(request: Request): Promise<RequestContext> {
  const tenantId = request.headers.get("x-tenant-id") ?? "demo-tenant";
  const userId = request.headers.get("x-user-id") ?? "user-demo-admin";

  if (!tenantId) {
    throw new ForbiddenError("Kiracı bilgisi olmadan işlem yapılamaz.");
  }

  const [user, membership] = await Promise.all([
    userRepository.findById(userId),
    userRepository.findMembership(userId, tenantId),
  ]);

  // Kullanıcı yoksa ya da bu tenant'ta üyeliği yoksa: RBAC'in ilk savunma
  // hattı burasıdır — rolü bile çözemediğimiz biri hiçbir işlem yapamaz.
  if (!user || !membership) {
    throw new ForbiddenError(`Bu kiracıda (${tenantId}) tanımlı bir üyeliğiniz yok.`);
  }

  return { tenantId, userId, userName: user.name, role: membership.role };
}
