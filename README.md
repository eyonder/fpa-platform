# FP&A Platform

Next.js 16 · TypeScript · Tailwind CSS 4 · ESLint 9 · Prettier 3

Bütçe planlama, sapma analizi, forecast, çok şirketli konsolidasyon, RBAC, denetim
(audit) izi ve Mizan/Muavin içe aktarma sihirbazı içeren bir FP&A ürünü. Arayüz kodu
ile sunucu kodu ayrı klasörlerde durur ve bu ayrım ESLint tarafından zorunlu kılınır.
Veri katmanı şu an bellek-içi (in-memory) demo repository'lerdir — gerçek bir
veritabanına bağlanmadan tüm iş mantığını uçtan uca deneyebilirsiniz (bkz. sondaki
"Henüz eklenmedi" tablosu).

---

## Hızlı başlangıç

```bash
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3000
```

Sağ üstteki kullanıcı seçiciden (demo kimlik doğrulama, bkz. aşağıda) farklı rollerle
gezinip RBAC'in gerçekten kısıtladığını görebilirsiniz.

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
| `/senaryolar`, `GET,POST /api/scenarios`       | Bütçe/Gerçekleşen/Tahmin senaryoları; kilitleme = onay adımı                    |
| `/butce-girisi`, `GET,POST /api/budget-lines`  | AG Grid tabanlı bütçe tablosu: hücre düzenleme, TSV yapıştırma, satır/sütun toplamı |
| `GET /api/variance`                            | Bütçe-gerçekleşen sapma (varyans) analizi, tutar + yüzde                        |
| `POST /api/forecast`                           | Geçmiş aylardan basit büyüme oranıyla kalan ayları projekte eder                 |
| `GET /api/consolidation`                       | Holding altındaki şirketleri kur çevrimiyle (çapraz kur destekli) tek para birimine toplar |
| `/ice-aktarma`, `POST /api/imports/*`          | Mizan/Muavin CSV veya Excel içe aktarma: kolon eşleştirme, önizleme, onay        |
| `/denetim-kaydi`, `GET /api/audit-logs`        | Her bütçe hücresi değişikliğinin eski/yeni değeri + kim/ne zaman/nereden yaptığı |
| RBAC (`backend/core/authorize.ts`)             | Admin / Bütçe Yöneticisi / Veri Giriş Uzmanı — tek bir izin tablosu              |

RBAC ve denetim izi için gerçek bir login yok; sağ üstteki **ActorSwitcher** demo
kullanıcılar arasında geçiş yapar (`x-user-id`/`x-tenant-id` header'ları,
`backend/core/tenant.ts`). Üretimde tek değişecek yer burasıdır — bkz. "Henüz
eklenmedi".

---

## Klasör yapısı

```
src/
├── app/                              YÖNLENDİRME KABUĞU
│   ├── layout.tsx                    kök HTML
│   ├── (app)/                        route group — URL'e yansımaz
│   │   ├── layout.tsx                üst menü + sayfa çerçevesi (AppShell)
│   │   ├── page.tsx                  "/"              → Genel Bakış
│   │   ├── senaryolar/               "/senaryolar"
│   │   ├── butce-girisi/             "/butce-girisi"  → AG Grid
│   │   ├── ice-aktarma/              "/ice-aktarma"   → import sihirbazı
│   │   └── denetim-kaydi/            "/denetim-kaydi" → audit log
│   └── api/                          BACKEND GİRİŞ NOKTASI
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
│   ├── screens/                      dashboard, scenarios, budget-entry, import, audit-log
│   ├── components/                   AppShell, ActorSwitcher, ui/ (Badge, Card), budget-grid/
│   ├── hooks/                        useScenarios, useBudgetLines, useAuditLogs
│   ├── lib/                          api-client, session-store, clipboard, format
│   └── styles/globals.css            Tailwind teması (@theme jetonları)
│
├── backend/                          SUNUCU KATMANI
│   ├── core/                         errors, http, logger, tenant, authorize (RBAC)
│   ├── config/env.ts                 ortam değişkeni doğrulaması
│   └── modules/
│       ├── scenarios/                senaryo CRUD + kilitle/aç
│       ├── budget-lines/             TEK bütçe yazma noktası (kilit + audit burada)
│       ├── variance/                 bütçe-gerçekleşen sapma hesabı
│       ├── forecast/                 basit büyüme oranlı projeksiyon
│       ├── organizations/, fx/       holding ağacı, döviz kuru + çapraz kur
│       ├── consolidation/            çok şirketli konsolidasyon algoritması
│       ├── users/                    demo kullanıcı/üyelik (rol kaynağı)
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

---

## Katmanlar arası kurallar

Bir isteğin izlediği yol:

```
Tarayıcı
  └─ frontend/screens        ekran
       └─ frontend/hooks     durum yönetimi
            └─ frontend/lib/api-client     ← frontend'in tek çıkış kapısı
                 │  HTTP (x-tenant-id / x-user-id header'ları eklenir)
                 ▼
            app/api/.../route.ts           ← ince controller
                 └─ backend/core/authorize.ts   yetkiyi doğrula (RBAC)
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
| Veritabanı         | PostgreSQL + Prisma            | Sadece `repository` dosyaları değişir                       |
| Çok kiracılık      | PostgreSQL RLS                 | `tenant.ts` içindeki bağlam RLS oturum değişkenine bağlanır  |
| Kimlik doğrulama   | NextAuth / Clerk               | Yalnızca `getRequestContext` gövdesi değişir; RBAC/audit aynı kalır |
| Ondalık hassasiyet | `decimal.js`                   | `shared/lib/money.ts` kuruş-bazlı yuvarlamayla bunu şimdilik hafifletiyor |
| Güncel döviz kuru  | Gerçek bir sağlayıcı (TCMB/ECB/…) | `fx/fx-rate.repository.ts` şu an sabit demo kur tablosu       |
| Arka plan işleri   | Redis + BullMQ (ayrı worker)   | Konsolidasyon/import route handler içinde çalıştırılmamalı   |
| Test               | Vitest + Playwright            | `service` katmanı saf olduğu için kolay test edilir          |

### Önemli mimari not

Konsolidasyon hesaplamaları ve büyük dosya içe aktarma gibi uzun süren işler API
route handler'ları içinde çalıştırılmamalıdır — sunucusuz ortamlarda zaman aşımı
sınırı vardır. Bu işler kuyruğa alınmalı, ayrı bir worker süreci tarafından
yürütülmelidir. `src/backend` katmanı bilerek framework'ten bağımsız tutulmuştur; o
worker aynı `service` dosyalarını değişiklik yapmadan kullanabilir.
