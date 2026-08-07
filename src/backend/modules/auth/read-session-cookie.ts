import { SESSION_COOKIE_NAME } from "./auth.constants";

/**
 * Ham `Cookie` header'ından oturum çerezini okur. `Request`/`Headers` Web
 * standardı olduğu için (Next.js'e özgü değil) bu, backend'in framework'ten
 * bağımsız kalma kuralını bozmaz — bkz. backend/core/tenant.ts.
 */
export function readSessionCookie(request: Request): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = part.slice(0, separatorIndex).trim();
    if (key !== SESSION_COOKIE_NAME) continue;
    return decodeURIComponent(part.slice(separatorIndex + 1).trim());
  }

  return undefined;
}
