import { authService } from "@/backend/modules/auth/auth.service";
import { readSessionCookie } from "@/backend/modules/auth/read-session-cookie";

import { UnauthorizedError } from "./errors";
import type { RequestContext } from "./request-context";

// Diğer dosyalar hâlâ `import type { RequestContext } from "@/backend/core/tenant"`
// yapıyor (bkz. budget-line.service.ts, forecast.service.ts, ...) — geriye
// dönük uyumluluk için burada yeniden dışa aktarılıyor.
export type { RequestContext };

/**
 * İstek bağlamını çözer: oturum çerezinden (fpa_session) kullanıcı, tenant
 * ve rolü okur.
 *
 * ÖNEMLİ: Kimlik artık İSTEMCİNİN İDDİA ETTİĞİ bir header'dan DEĞİL, sunucu
 * tarafında tutulan bir oturum kaydından geliyor (bkz. modules/auth/). Eskiden
 * (demo ActorSwitcher döneminde) x-user-id/x-tenant-id header'larına
 * güveniliyordu — bu, gerçek bir login olmadan kabul edilebilirdi ama gerçek
 * girişle birlikte istemcinin "ben Admin'im" diye header basıp yetki
 * yükseltmesine (privilege escalation) izin verirdi. Artık öyle değil.
 *
 * Tüm route'lar buradan geçtiği için hem tenant izolasyonu hem RBAC tek
 * noktadan kontrol edilir.
 */
export async function getRequestContext(request: Request): Promise<RequestContext> {
  const sessionId = readSessionCookie(request);
  const context = await authService.resolveSessionContext(sessionId);

  if (!context) {
    throw new UnauthorizedError(
      "Oturum bulunamadı ya da süresi dolmuş. Lütfen tekrar giriş yapın.",
    );
  }

  return context;
}
