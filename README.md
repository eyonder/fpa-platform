# FP&A Platform

Next.js 16 · TypeScript · Tailwind CSS 4 · ESLint 9 · Prettier 3

Bütçe planlama, sapma analizi, forecast, çok şirketli konsolidasyon, giriş/oturum
yönetimi, RBAC, denetim (audit) izi ve Mizan/Muavin içe aktarma sihirbazı içeren bir
FP&A ürünü. Arayüz kodu ile sunucu kodu ayrı klasörlerde durur ve bu ayrım ESLint
tarafından zorunlu kılınır. Veri katmanı şu an bellek-içi (in-memory) demo
repository'lerdir — gerçek bir veritabanına bağlanmadan tüm iş mantığını uçtan uca
deneyebilirsiniz (bkz. sondaki "Henüz eklenmedi" tablosu).

---

## Hızlı başlangıç

```bash
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3000
```

`/giris` ekranından demo hesaplardan biriyle giriş yapın (şifre hepsinde aynı:
`Demo1234!` — sayfanın altında listeli):

| E-posta                    | Rol                 |
| --------------------------- | -------------------- |
| `aylin@demo-tenant.test`   | Admin                |
| `baris@demo-tenant.test`   | Bütçe Yöneticisi     |
| `deniz@demo-tenant.test`   | Veri Giriş Uzmanı    |
| `hale@org-holding.test`    | Admin (Holding)      |

Farklı hesaplarla çıkış yapıp tekrar girerek RBAC'in gerçekten kısıtladığını
görebilirsiniz (bkz. "Modüller"deki RBAC satırı).

## Komutlar

| Komut                  | Ne yapar                                            |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev`          | Geliştirme sunucusu                                  |
| `npm run build`        | Üretim derlemesi                                     |
| `npm start`            | Derlenmiş uygulamayı çalıştırır                      |
| `npm run typecheck`    | TypeScript tip kontrolü                              |
| `npm run lint`         | ESLint (mimari sınır kuralları dahil)                |
| `npm run lint:fix`     | Otomatik düzeltilebilen lint hatalarını giderir       |
| `npm run format`       | Prettier ile tüm dosyaları biçimlendirir             |
| `npm run format:check` | Biçim bozuksa hata verir (CI için)                   |
| `npm run check`        | Üçünü birden çalıştırır — commit öncesi bunu koşun   |

---

## Modüller

| Ekran / uç nokta                              | Ne yapar                                                                        |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `/giris`, `/sifremi-unuttum`, `/sifre-sifirla` | E-posta+şifre girişi, KVKK aydınlatma metni, şifre sıfırlama akışı — bkz. aşağıda |
| `/senaryolar`, `GET,POST /api/scenarios`       | Bütçe/Gerçekleşen/Tahmin senaryoları; kilitleme = onay adımı                    |
| `/butce-girisi`, `GET,POST /api/budget-lines`  | AG Grid tabanlı bütçe tablosu: hücre düzenleme, TSV yapıştırma, satır/sütun toplamı |
| `GET /api/variance`                            | Bütçe-gerçekleşen sapma (varyans) analizi, tutar + yüzde                        |
| `POST /api/forecast`                           | Geçmiş aylardan basit büyüme oranıyla kalan ayları projekte eder                 |
| `GET /api/consolidation`                       | Holding altındaki şirketleri kur çevrimiyle (çapraz kur destekli) tek para birimine toplar |
| `/ice-aktarma`, `POST /api/imports/*`          | Mizan/Muavin CSV veya Excel içe aktarma: kolon eşleştirme, önizleme, onay        |
| `/denetim-kaydi`, `GET /api/audit-logs`        | Her bütçe hücresi değişikliğinin eski/yeni değeri + kim/ne zaman/nereden yaptığı |
| RBAC (`backend/core/authorize.ts`)             | Admin / Bütçe Yöneticisi / Veri Giriş Uzmanı — tek bir izin tablosu              |

Giriş, httpOnly bir oturum çerezi (`fpa_session`) set eder; kimlik artık bu çerezden
çözülür (`backend/core/tenant.ts`) — istemcinin "ben Admin'im" diye bir header
basması artık MÜMKÜN DEĞİL (eskiden, gerçek login gelmeden önce, demo bir
ActorSwitcher header'la kimlik taşıyordu — bkz. git geçmişi). `src/proxy.ts`
(Next.js 16'da "middleware" adı "proxy" oldu) oturumsuz istekleri `/giris`e
yönlendirir; asıl yetkilendirme her API isteğinde `getRequestContext` ve her sayfa
render'ında `(app)/layout.tsx` tarafından ayrıca doğrulanır. MFA eklemek için bkz.
`auth.service.ts`'teki `login` fonksiyonunun içindeki yorum — parola doğrulaması ile
oturum kurma arasına net bir genişletme noktası bırakıldı.

---

## Klasör yapısı

```
src/
├── proxy.ts                          sayfa koruması — oturumsuz isteği /giris'e yönlendirir
├── app/                              YÖNLENDİRME KABUĞU
│   ├── layout.tsx                    kök HTML
│   ├── giris/, sifremi-unuttum/,     AppShell'siz, herkese açık auth sayfaları
│   │   sifre-sifirla/
│   ├── (app)/                        route group — URL'e yansımaz, GİRİŞ GEREKTİRİR
│   │   ├── layout.tsx                server-side oturum kontrolü + AppShell
│   │   ├── get-current-user.ts       (düz .ts — bkz. "Katmanlar arası kurallar")
│   │   ├── page.tsx                  "/"              → Genel Bakış
│   │   ├── senaryolar/               "/senaryolar"
│   │   ├── butce-girisi/             "/butce-girisi"  → AG Grid
│   │   ├── ice-aktarma/              "/ice-aktarma"   → import sihirbazı
│   │   └── denetim-kaydi/            "/denetim-kaydi" → audit log
│   └── api/                          BACKEND GİRİŞ NOKTASI
│       ├── auth/                     login, logout, forgot-password, reset-password
│       ├── health/
│       ├── scenarios/route.ts        + [id]/lock, [id]/unlock
│       ├── budget-lines/route.ts
│       ├── variance/route.ts
│       ├── forecast/route.ts
│       ├── consolidation/route.ts
│       ├── audit-logs/route.ts
│       └── imports/route.ts          + [id]/route.ts, [id]/commit/route.ts
│
├── frontend/                         KULLANICI ARAYÜZÜ
│   ├── screens/                      dashboard, scenarios, budget-entry, import, audit-log, auth/
│   ├── components/                   AppShell, LogoutButton, AydinlatmaMetni, ui/, budget-grid/
│   ├── hooks/                        useScenarios, useBudgetLines, useAuditLogs
│   ├── lib/                          api-client, clipboard, format, role-labels
│   └── styles/globals.css            Tailwind teması (@theme jetonları)
│
├── backend/                          SUNUCU KATMANI
│   ├── core/                         errors, http, logger, tenant, authorize (RBAC),
│   │                                 request-context, rate-limit, global-store
│   ├── config/env.ts                 ortam değişkeni doğrulaması
│   └── modules/
│       ├── auth/                     login/logout/oturum + şifre sıfırlama
│       ├── users/                    demo kullanıcı/üyelik (bcrypt hash, rol kaynağı)
│       ├── scenarios/                senaryo CRUD + kilitle/aç
│       ├── budget-lines/             TEK bütçe yazma noktası (kilit + audit burada)
│       ├── variance/                 bütçe-gerçekleşen sapma hesabı
│       ├── forecast/                 basit büyüme oranlı projeksiyon
│       ├── organizations/, fx/       holding ağacı, döviz kuru + çapraz kur
│       ├── consolidation/            çok şirketli konsolidasyon algoritması
│       ├── audit/                    hücre bazlı eski/yeni değer kaydı
│       └── imports/                  CSV/Excel parse, kolon eşleştirme, commit
│
└── shared/                           ORTAK SÖZLEŞME
    ├── types/                        iki tarafın da kullandığı saf tipler
    ├── constants/                    para birimi, aylar
    └── lib/                          money.ts (kuruş-bazlı yuvarlama), parse-amount.ts
```

### Neden `app/` klasörü hâlâ duruyor?

Next.js, sayfaları ve API uçlarını **zorunlu olarak** `src/app/` altında arar. Bu
klasörü `frontend/` ve `backend/` diye ikiye bölemeyiz — framework böyle çalışmaz.

Çözüm: `src/app` yalnızca bir **kablo tablosu** olarak kullanılır. İçindeki dosyalar
bilerek birkaç satırdır; gerçek kod `frontend/` ve `backend/` altındadır. Örnek:

```ts
// src/app/(app)/senaryolar/page.tsx  — tamamı bu kadar
export { ScenariosScreen as default } from "@/frontend/screens/scenarios/ScenariosScreen";
```

**İnce ama önemli bir istisna**: `eslint.config.mjs`'teki sınır kuralı `src/app/**/*.tsx`
dosyalarının (`page.tsx`, `layout.tsx`) `@/backend/*` import etmesini yasaklar — bunlar
React bileşeni olduğu için "arayüz" sayılır, sadece `.ts` uzantılı `route.ts`
handler'ları backend'i doğrudan çağırabilir. `(app)/layout.tsx` server-side oturum
kontrolü yapmak ZORUNDA olduğu için, backend çağrısını yapan mantık düz bir `.ts`
dosyasına (`(app)/get-current-user.ts`) çıkarılıp layout oradan göreli bir import
yapar — bkz. o dosyadaki yorum.

---

## Katmanlar arası kurallar

Bir isteğin izlediği yol:

```
Tarayıcı (fpa_session httpOnly çerezi otomatik gider)
  └─ frontend/screens        ekran
       └─ frontend/hooks     durum yönetimi
            └─ frontend/lib/api-client     ← frontend'in tek çıkış kapısı
                 │  HTTP
                 ▼
            app/api/.../route.ts           ← ince controller
                 └─ backend/core/tenant.ts      çerezden kimliği çöz (401 UNAUTHORIZED)
                      └─ backend/core/authorize.ts   yetkiyi doğrula (403 FORBIDDEN — RBAC)
                           └─ backend/modules/*/schema      girdiyi doğrula
                                └─ backend/modules/*/service   iş kuralları + audit
                                     └─ backend/modules/*/repository   veritabanı
```

Bu kurallar `eslint.config.mjs` içinde `no-restricted-imports` ile **zorunlu kılınır**:

- `frontend/` → `backend/` import edemez.
- `backend/` → `frontend/`, `react` veya `next/navigation` import edemez.
- `shared/` → hiçbir tarafa bağımlı olamaz.

Denerseniz `npm run lint` Türkçe bir hata mesajıyla durur. Klasör ayrımı böylece
zamanla aşınmaz.

**Tek bütçe yazma noktası**: `budget-lines/budget-line.service.ts`'teki `bulkUpsert`,
manuel hücre düzenlemesi, forecast persist ve import commit'in **hepsinin** geçtiği
tek yoldur. Kilit kontrolü ve audit kaydı burada bir kere yazılır; yeni bir yazma yolu
eklerseniz mutlaka bu fonksiyonu çağırmalı, `budgetLineRepository.bulkUpsert`'i
doğrudan çağırmamalıdır (aksi halde o yol audit'siz ve kilitsiz kalır).

**Bellek-içi repository'ler `getGlobalStore` (`backend/core/global-store.ts`)
kullanmak ZORUNDA**, düz modül-seviyesi `new Map()`/`[]` DEĞİL. Bunun nedeni
teorik değil, canlı yaşanmış bir hataydı: Next.js/Turbopack, Route Handler'ları
(`app/api/**/route.ts`) ve Server Component'leri (`app/**/*.tsx`) FARKLI modül
paketlerinde derleyebiliyor — `/api/auth/login`'in yazdığı oturum kaydı,
`(app)/layout.tsx`'in server-side session kontrolünde "yokmuş" gibi görünüyordu,
çünkü ikisi `session.repository.ts`'in iki ayrı kopyasına bakıyordu. `getGlobalStore`,
`globalThis` üzerinde gerçek bir tekil (singleton) tutarak bunu çözer. Yeni bir
bellek-içi repository eklerseniz bu deseni kullanın.

---

## Bir özellik nasıl eklenir

Örnek: hesap planı (`accounts`).

1. `src/shared/types/account.ts` → `Account` tipini yaz.
2. `src/backend/modules/accounts/account.schema.ts` → Zod doğrulaması.
3. `src/backend/modules/accounts/account.repository.ts` → veri erişimi.
4. `src/backend/modules/accounts/account.service.ts` → iş kuralları.
5. `src/app/api/accounts/route.ts` → `handleRoute` ile 5–10 satırlık controller;
   `assertPermission` ile RBAC iznini ekle (bkz. `backend/core/authorize.ts`).
6. `src/frontend/screens/accounts/AccountsScreen.tsx` → ekran.
7. `src/app/(app)/hesaplar/page.tsx` → tek satırlık bağlantı.

Sıra hep aynıdır: **tip → doğrulama → veri → kural → uç nokta → ekran → URL.**

---

## Hata yönetimi

Tüm API uçları tek tip zarf döner:

```jsonc
// başarılı
{ "ok": true, "data": { } }

// hatalı
{ "ok": false, "error": { "code": "SCENARIO_NAME_TAKEN", "message": "…" } }

// doğrulama hatası — alan bazlı, forma doğrudan bağlanabilir
{ "ok": false, "error": { "code": "VALIDATION_FAILED", "fields": { "name": ["…"] } } }

// yetki hatası (RBAC)
{ "ok": false, "error": { "code": "FORBIDDEN", "message": "…" } }
```

Servis katmanında `throw new AppError(...)` demeniz yeterlidir; `handleRoute`
sarmalayıcısı bunu doğru HTTP koduna ve JSON'a çevirir, beklenmeyen hatalarda iç
detayları istemciye sızdırmaz.

---

## Henüz eklenmedi (bilinçli olarak)

| Alan               | Öneri                          | Notu                                                        |
| ------------------- | ------------------------------- | -------------------------------------------------------------- |
| Veritabanı         | PostgreSQL + Prisma            | Sadece `repository` dosyaları değişir (ve `getGlobalStore` gereksizleşir) |
| Çok kiracılık      | PostgreSQL RLS                 | `tenant.ts` içindeki bağlam RLS oturum değişkenine bağlanır  |
| Kimlik doğrulama sağlayıcısı | NextAuth / Clerk (opsiyonel) | Basit e-posta+şifre girişi zaten VAR (bkz. yukarıdaki tablo); bir SSO/sosyal login sağlayıcısına geçilirse sadece `auth.service.ts`/`getCurrentUser` değişir |
| MFA (çok faktörlü doğrulama) | TOTP (ör. `otplib`) ya da SMS/e-posta kodu | `auth.service.ts`'teki `login` fonksiyonunda tam olarak nereye ekleneceği yorumla işaretli |
| Oturum deposu      | Redis                          | Yatay ölçeklendiğinde (birden fazla sunucu örneği) bellek-içi oturum Map'i paylaşılmaz |
| Ondalık hassasiyet | `decimal.js`                   | `shared/lib/money.ts` kuruş-bazlı yuvarlamayla bunu şimdilik hafifletiyor |
| Güncel döviz kuru  | Gerçek bir sağlayıcı (TCMB/ECB/…) | `fx/fx-rate.repository.ts` şu an sabit demo kur tablosu       |
| E-posta gönderimi  | SES/SendGrid/…                 | Şifre sıfırlama bağlantısı şu an sadece sunucu logunda görünür |
| Arka plan işleri   | Redis + BullMQ (ayrı worker)   | Konsolidasyon/import route handler içinde çalıştırılmamalı   |
| Test               | Vitest + Playwright            | `service` katmanı saf olduğu için kolay test edilir          |

### Önemli mimari not

Konsolidasyon hesaplamaları ve büyük dosya içe aktarma gibi uzun süren işler API
route handler'ları içinde çalıştırılmamalıdır — sunucusuz ortamlarda zaman aşımı
sınırı vardır. Bu işler kuyruğa alınmalı, ayrı bir worker süreci tarafından
yürütülmelidir. `src/backend` katmanı bilerek framework'ten bağımsız tutulmuştur; o
worker aynı `service` dosyalarını değişiklik yapmadan kullanabilir.
