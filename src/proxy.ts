import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * SAYFA KORUMASI — hızlı/kaba bir kapıdır, tek başına yeterli DEĞİLDİR.
 *
 * (Next.js 16'da "middleware" dosya biçimi kullanımdan kalktı, yerini
 * "proxy" aldı — davranış aynı, sadece dosya/fonksiyon adı değişti.)
 *
 * Burada sadece oturum çerezinin VARLIĞINA bakılır (bellek-içi oturum
 * deposuna burada erişilmiyor). Çerez var ama geçersiz/süresi dolmuşsa (ör.
 * sunucu yeniden başladı, bellek-içi depo sıfırlandı) burası fark etmez —
 * asıl, YETKİLİ kontrol her zaman:
 *   - API uçlarında: backend/core/tenant.ts (her istekte, 401 fırlatır)
 *   - Sayfalarda: src/app/(app)/layout.tsx (server-side, redirect eder)
 * Yani bu proxy sadece "hiç çerezi olmayanı" en erken adımda geri gönderip
 * gereksiz sayfa render'ını önler; gerçek doğrulama iki katmanda ayrıca yapılır.
 */

const SESSION_COOKIE_NAME = "fpa_session";
const PUBLIC_PATHS = ["/giris", "/sifremi-unuttum", "/sifre-sifirla"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  ) {
    return NextResponse.next();
  }

  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/giris";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // /api, /_next, statik dosyalar hariç HER şey — API'ler kendi 401'ini
  // zaten üretir; /giris vb. yukarıdaki PUBLIC_PATHS ile ayrıca serbest.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
