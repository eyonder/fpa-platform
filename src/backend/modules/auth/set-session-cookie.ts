import type { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "./auth.constants";

/**
 * `httpOnly` oturum çerezini set eder — `/api/auth/login` ve
 * `/api/auth/mfa/verify` (MFA doğrulandıktan SONRA oturum kuran yol) TARAFINDAN
 * AYNI ŞEKİLDE kullanılır, bu yüzden tek bir yerde yaşar.
 */
export function setSessionCookie(
  response: NextResponse,
  sessionId: string,
  maxAgeSeconds: number,
): void {
  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}
