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

/**
 * `POST /api/auth/login` VE `POST /api/auth/mfa/verify` — ikisi de bu şekli
 * döner. `MFA_REQUIRED` bir hata DEĞİLDİR, parola doğru — sadece oturum
 * henüz kurulmadı (bkz. backend/modules/auth/auth.service.ts).
 */
export type LoginResponse =
  | { status: "OK"; user: AuthenticatedUser }
  | { status: "MFA_REQUIRED"; challengeId: string };
