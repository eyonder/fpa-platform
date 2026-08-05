/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * RBAC (Rol Bazlı Erişim Kontrolü): üç rol, izinler backend/core/authorize.ts'te tanımlı.
 */
export type Role = "ADMIN" | "BUDGET_MANAGER" | "DATA_ENTRY";

export interface User {
  id: string;
  name: string;
  email: string;
}

/** Bir kullanıcının bir tenant'taki (kiracıdaki) rolü — çoklu-tenant üyelik. */
export interface Membership {
  userId: string;
  tenantId: string;
  role: Role;
}
