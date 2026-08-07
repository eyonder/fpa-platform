import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME } from "@/backend/modules/auth/auth.constants";
import { authService } from "@/backend/modules/auth/auth.service";

/**
 * `.tsx` DEĞİL, düz `.ts` — bu bilerek böyle. `eslint.config.mjs`'teki
 * "sinir/frontend" kuralı `src/app/**\/*.tsx` dosyalarının `@/backend/*`
 * import etmesini yasaklar (page/layout'lar React bileşeni olduğu için
 * "arayüz" sayılır). Bu küçük `.ts` dosyası o sınırın DIŞINDA kalır ve
 * `layout.tsx`'e (aynı klasörden, göreli bir import ile) backend'i
 * çağırmadan session bilgisini verir.
 */
export async function getCurrentUser() {
  const sessionId = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return authService.resolveSessionContext(sessionId);
}
