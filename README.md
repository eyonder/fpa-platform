# FP&A Platform

Next.js 16 · TypeScript · Tailwind CSS 4 · ESLint 9 · Prettier 3

Bütçe planlama, sapma analizi, forecast, çok şirketli konsolidasyon, giriş/oturum
yönetimi, RBAC, denetim (audit) izi ve Mizan/Muavin içe aktarma sihirbazı içeren bir
FP&A ürünü. Arayüz kodu ile sunucu kodu ayrı klasörlerde durur ve bu ayrım ESLint
tarafından zorunlu kılınır. Veri katmanı gerçek bir PostgreSQL veritabanıdır
(Prisma ORM), çok kiracılık PostgreSQL **Row-Level Security (RLS)** ile veritabanı
seviyesinde zorunlu kılınır — bkz. "Veri katmanı ve çok kiracılık" bölümü.

---

## Hızlı başlangıç

```bash
npm install
docker compose up -d          # yerel PostgreSQL (bkz. docker-compose.yml)
cp .env.example .env.local    # DATABASE_URL / APP_DATABASE_URL / DATABASE_URL_BYPASS_RLS doldurun
npx prisma migrate dev        # şema + RLS politikalarını uygular
npm run db:seed               # demo veriyi yükler
npm run dev                   # http://localhost:3000
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
| `npm run db:migrate`   | Yeni bir Prisma migration oluşturur + uygular         |
| `npm run db:seed`      | Demo veriyi (yeniden) yükler — bkz. `prisma/seed.ts`  |
| `npm run db:studio`    | Prisma Studio (veritabanını tarayıcıda görüntüle)     |
| `npm run db:reset`     | Veritabanını sıfırlar, migration'ları + seed'i yeniden uygular |

---

## Modüller

| Ekran / uç nokta                              | Ne yapar                                                                        |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `/giris`, `/sifremi-unuttum`, `/sifre-sifirla` | E-posta+şifre girişi, şifre sıfırlama akışı — bkz. aşağıda                       |
| `/senaryolar`, `GET,POST /api/scenarios`       | Bütçe/Gerçekleşen/Tahmin senaryoları; kilitleme = onay adımı                    |
| `/butce-girisi`, `GET,POST /api/budget-lines`  | AG Grid tabanlı bütçe tablosu: hücre düzenleme, TSV yapıştırma, satır/sütun toplamı |
| `GET /api/variance`                            | Bütçe-gerçekleşen sapma (varyans) analizi, tutar + yüzde                        |
| `POST /api/forecast`                           | Geçmiş aylardan basit büyüme oranıyla kalan ayları projekte eder                 |
| `GET /api/consolidation`                       | Holding altındaki şirketleri kur çevrimiyle (çapraz kur destekli) tek para birimine toplar |
| `/ice-aktarma`, `POST /api/imports/*`          | Mizan/Muavin CSV veya Excel içe aktarma: kolon eşleştirme, önizleme, onay        |
| `/denetim-kaydi`, `GET /api/audit-logs`        | Her bütçe hücresi değişikliğinin eski/yeni değeri + kim/ne zaman/nereden yaptığı |
| `/hesap`, `GET,POST /api/account/mfa*`         | TOTP MFA enroll/disable (QR + yedek kodlar) — bkz. aşağıdaki paragraf            |
| `/personel`, `GET,POST /api/personnel*`        | Personel + ücret geçmişi, brüt↔net Türkiye bordro motoru, bordro çalıştırma — SADECE Admin (bkz. aşağıdaki paragraf) |
| RBAC (`backend/core/authorize.ts`)             | Admin / Bütçe Yöneticisi / Veri Giriş Uzmanı — tek bir izin tablosu              |

Giriş, httpOnly bir oturum çerezi (`fpa_session`) set eder; kimlik artık bu çerezden
çözülür (`backend/core/tenant.ts`) — istemcinin "ben Admin'im" diye bir header
basması artık MÜMKÜN DEĞİL (eskiden, gerçek login gelmeden önce, demo bir
ActorSwitcher header'la kimlik taşıyordu — bkz. git geçmişi). `src/proxy.ts`
(Next.js 16'da "middleware" adı "proxy" oldu) oturumsuz istekleri `/giris`e
yönlendirir; asıl yetkilendirme her API isteğinde `getRequestContext` ve her sayfa
render'ında `(app)/layout.tsx` tarafından ayrıca doğrulanır.

**TOTP MFA** (`backend/modules/auth/mfa.service.ts`) `/hesap`'tan etkinleştirilir:
QR kod okutma + kod onayı + 10 tek kullanımlık yedek kod. Sır DB'de asla düz metin
değil (`backend/core/crypto.ts`, AES-256-GCM, `MFA_ENCRYPTION_KEY`). Etkinse login
`{status:"MFA_REQUIRED", challengeId}` döner, oturum sadece `/api/auth/mfa/verify`
başarılı olunca kurulur (bkz. `auth.service.ts`teki `LoginOutcome`). Şifre
sıfırlama + MFA bildirimleri `backend/core/email.ts` üzerinden SendGrid ile
gönderilir — `SENDGRID_API_KEY`/`EMAIL_FROM` boşsa sessizce sunucu logu
fallback'ine döner (yerel geliştirme SendGrid gerektirmez).

**Personel & Bordro** (`backend/modules/personnel/`, Faz 2.1) — SADECE Admin
görebilir (`payroll:read`/`payroll:write`, `BUDGET_MANAGER`'a bile verilmez —
uygulamadaki ilk gerçek ADMIN/BUDGET_MANAGER izin ayrımı). `Employee`/
`EmployeeCompensation` RLS'e tabidir VE ücret tutarı ayrıca AES-256-GCM ile
şifreli saklanır (`compensationCiphertext`, `backend/core/crypto.ts`) — RLS +
şifreleme birlikte, maaş verisi için çift katmanlı koruma sağlar.
`payroll-calculator.ts`, 2026 SGK/vergi parametreleriyle (`PayrollTaxConfig` —
küresel, kod içine gömülmemiş, `prisma/seed.ts`te veri olarak tutulur) brüt↔net
hesaplar: kümülatif gelir vergisi matrahı (dilim aşımı doğru), SGK tavanı,
emekli (SGDP) ve kapıcı (tam muaf) özel durumları, engellilik indirimi, asgari
ücret istisnası, fazla mesai. "Bordro Çalıştır" önizlemesi hiçbir şey yazmaz;
"Bütçeye Yaz" toplam işveren maliyetini `budgetLineService.bulkUpsert`
(`source: PAYROLL`) üzerinden "Personel Giderleri" kategorisine yazar — kilit
kontrolü ve audit kaydı oradan otomatik gelir, ikinci bir yazma noktası YOKTUR.

---

## Klasör yapısı

Proje kökünde ayrıca `prisma/` (`schema.prisma`, `migrations/`, `seed.ts`) ve
`docker-compose.yml` (yerel PostgreSQL) bulunur — `src/` dışında, çünkü Prisma CLI
bunları oradan bekler.

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
│   ├── components/                   AppShell, LogoutButton, ui/, budget-grid/
│   ├── hooks/                        useScenarios, useBudgetLines, useAuditLogs
│   ├── lib/                          api-client, clipboard, format, role-labels
│   └── styles/globals.css            Tailwind teması (@theme jetonları)
│
├── backend/                          SUNUCU KATMANI
│   ├── core/                         errors, http, logger, tenant (withTenantContext),
│   │                                 authorize (RBAC), request-context, rate-limit,
│   │                                 prisma-client (RLS extension), tenant-context (ALS),
│   │                                 global-store (Turbopack-güvenli singleton yardımcısı)
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

---

## Veri katmanı ve çok kiracılık

Veri katmanı PostgreSQL + Prisma'dır (`prisma/schema.prisma`). Çok kiracılık İKİ
katmanda uygulanır:

1. **Uygulama katmanı**: her repository sorgusu hâlâ `tenantId` ile de filtrelenir
   (ör. `scenario.repository.ts`).
2. **Veritabanı katmanı (asıl savunma hattı)**: PostgreSQL **Row-Level Security**.
   `Scenario`/`BudgetLine`/`AuditLog`/`ImportJob` tablolarında RLS aktif ve
   **FORCE** edilmiş (bkz. `prisma/migrations/*_enable_rls/migration.sql`); her
   sorgu, o transaction'ın ilk ifadesi olan `SET LOCAL app.current_tenant_id`
   değerine göre filtrelenir. Bu değeri kim, ne zaman set eder:
   - `backend/core/tenant-context.ts` — istek başına `AsyncLocalStorage` bağlamı
     (`getGlobalStore` ile Turbopack-güvenli tekil, bkz. aşağıdaki not).
   - `backend/core/tenant.ts`teki `withTenantContext(request, handler)` — TÜM API
     route'larının kullandığı sarmalayıcı; `TenantContext.run()` ile bağlamı kurar.
     **`.enterWith()` KASITLI OLARAK kullanılmıyor** — izole testlerle doğrulandı ki
     bir `await`den SONRA çağrılan `enterWith`, çağıranın bunu asla görememesine yol
     açıyor (bkz. `tenant-context.ts`teki ayrıntılı yorum).
   - `backend/core/prisma-client.ts`teki Prisma Client Extension, bu bağlamı okuyup
     `SET LOCAL`'i otomatik çalıştırır.

**Üç ayrı Postgres rolü/bağlantısı VAR, KASITLI** (bkz. `.env.example` ve
`prisma/migrations/*_enable_rls/migration.sql`'deki not): yerel Docker imajının
bootstrap kullanıcısı (`fpa`) SUPERUSER'dır ve superuser'lar RLS'i HER ZAMAN atlar
(`FORCE ROW LEVEL SECURITY` bile bunu değiştiremez) — bu yüzden uygulama çalışma
zamanı ayrı, owner OLMAYAN bir rolle (`APP_DATABASE_URL` → `fpa_app`) bağlanır.
Üçüncü rol (`DATABASE_URL_BYPASS_RLS` → `fpa_bypass_rls`, `BYPASSRLS` özniteliğiyle)
SADECE `consolidation.service.ts` kullanır — o servis holding'in BİRDEN ÇOK alt
şirketinin verisini TEK istekte okur, RLS'in "aktif bağlamda tek tenant" varsayımıyla
temelden çelişir; servis kendi yetki kontrolünü (`requestingTenantId !== parent.id` →
`ForbiddenError`) veriye dokunmadan ÖNCE zaten yapıyor.

Çok adımlı, atomik yazma akışları (ör. `budgetLineService.bulkUpsert` — kilit
kontrolü + audit kaydı + gerçek yazma) `backend/core/prisma-client.ts`teki
`withTenantTransaction` ile TEK bir `$transaction` içinde çalışır; repository
fonksiyonları bunun için opsiyonel bir `client: PrismaClientOrTx` parametresi alır.

`backend/core/global-store.ts`teki `getGlobalStore` yardımcı fonksiyonu hâlâ
YAŞIYOR — artık bellek-içi mock veri için DEĞİL, tek bir `PrismaClient` bağlantı
havuzunu ve tek bir `AsyncLocalStorage` örneğini `globalThis` üzerinde gerçek birer
singleton tutmak için (aynı Turbopack dual-bundle riski burada da geçerli — bkz. o
dosyadaki güncellenmiş yorum).

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

PostgreSQL + Prisma + RLS ve TOTP MFA + gerçek e-posta gönderimi artık tamam
(bkz. "Veri katmanı ve çok kiracılık" ve MFA paragrafları yukarıda) — aşağıdaki
liste onlardan sonra kalanlar içindir.

| Alan               | Öneri                          | Notu                                                        |
| ------------------- | ------------------------------- | -------------------------------------------------------------- |
| Kimlik doğrulama sağlayıcısı | NextAuth / Clerk (opsiyonel) | Basit e-posta+şifre girişi zaten VAR (bkz. yukarıdaki tablo); bir SSO/sosyal login sağlayıcısına geçilirse sadece `auth.service.ts`/`getCurrentUser` değişir |
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
