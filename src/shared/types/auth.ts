import type { Role } from "./user";

/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * `POST /api/auth/login` başarılı yanıtı — asla passwordHash içermez.
 */
export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  tenantId: string;
  role: Role;
}
