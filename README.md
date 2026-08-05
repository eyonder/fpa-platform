# FP&A Platform — Proje İskeleti

Next.js 16 · TypeScript · Tailwind CSS 4 · ESLint 9 · Prettier 3

Bütçe planlama, konsolidasyon ve senaryo analizi ürünü için hazırlanmış başlangıç
projesi. Arayüz kodu ile sunucu kodu ayrı klasörlerde durur ve bu ayrım ESLint
tarafından zorunlu kılınır.

---

## Hızlı başlangıç

```bash
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3000
```

## Komutlar

| Komut                  | Ne yapar                                             |
| ---------------------- | ---------------------------------------------------- |
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

## Klasör yapısı

```
src/
├── app/                        YÖNLENDİRME KABUĞU
│   ├── layout.tsx              kök HTML
│   ├── (app)/                  route group — URL'e yansımaz
│   │   ├── layout.tsx          üst menü + sayfa çerçevesi
│   │   ├── page.tsx            "/"           → ekranı bağlar
│   │   └── senaryolar/page.tsx "/senaryolar" → ekranı bağlar
│   └── api/                    BACKEND GİRİŞ NOKTASI
│       ├── health/route.ts     GET  /api/health
│       └── scenarios/route.ts  GET, POST /api/scenarios
│
├── frontend/                   KULLANICI ARAYÜZÜ
│   ├── screens/                sayfa düzeyi ekranlar
│   ├── components/             paylaşılan bileşenler (ui/ altında atomlar)
│   ├── hooks/                  React hook'ları
│   ├── lib/                    api-client, biçimlendirme
│   └── styles/globals.css      Tailwind teması (@theme jetonları)
│
├── backend/                    SUNUCU KATMANI
│   ├── core/                   errors, http, logger, tenant
│   ├── config/env.ts           ortam değişkeni doğrulaması
│   └── modules/
│       └── scenarios/
│           ├── scenario.schema.ts      girdi doğrulama (Zod)
│           ├── scenario.service.ts     iş mantığı
│           └── scenario.repository.ts  veri erişimi
│
└── shared/                     ORTAK SÖZLEŞME
    ├── types/                  iki tarafın da kullandığı saf tipler
    └── constants/              para birimi, hassasiyet
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
                 │  HTTP
                 ▼
            app/api/.../route.ts           ← ince controller
                 └─ backend/modules/*/schema      girdiyi doğrula
                      └─ backend/modules/*/service   iş kuralları
                           └─ backend/modules/*/repository   veritabanı
```

Bu kurallar `eslint.config.mjs` içinde `no-restricted-imports` ile **zorunlu kılınır**:

- `frontend/` → `backend/` import edemez.
- `backend/` → `frontend/`, `react` veya `next/navigation` import edemez.
- `shared/` → hiçbir tarafa bağımlı olamaz.

Denerseniz `npm run lint` Türkçe bir hata mesajıyla durur. Klasör ayrımı böylece
zamanla aşınmaz.

---

## Bir özellik nasıl eklenir

Örnek: hesap planı (`accounts`).

1. `src/shared/types/account.ts` → `Account` tipini yaz.
2. `src/backend/modules/accounts/account.schema.ts` → Zod doğrulaması.
3. `src/backend/modules/accounts/account.repository.ts` → veri erişimi.
4. `src/backend/modules/accounts/account.service.ts` → iş kuralları.
5. `src/app/api/accounts/route.ts` → `handleRoute` ile 5–10 satırlık controller.
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
```

Servis katmanında `throw new AppError(...)` demeniz yeterlidir; `handleRoute`
sarmalayıcısı bunu doğru HTTP koduna ve JSON'a çevirir, beklenmeyen hatalarda iç
detayları istemciye sızdırmaz.

---

## Henüz eklenmedi (bilinçli olarak)

Bu iskelet yalnızca istenen dört parçayı içerir. Aşağıdakiler sıradaki adımlardır:

| Alan               | Öneri                          | Notu                                                     |
| ------------------ | ------------------------------ | -------------------------------------------------------- |
| Veritabanı         | PostgreSQL + Prisma            | Sadece `repository` dosyaları değişir                    |
| Çok kiracılık      | PostgreSQL RLS                 | `tenant.ts` içindeki bağlam RLS oturum değişkenine bağlanır |
| Kimlik doğrulama   | NextAuth / Clerk               | Yalnızca `getRequestContext` gövdesi değişir              |
| Excel benzeri grid | AG Grid Enterprise             | Ticari lisans gerekir                                     |
| Ondalık hassasiyet | `decimal.js`                   | JavaScript `number` tipi para için güvenli değildir       |
| Arka plan işleri   | Redis + BullMQ (ayrı worker)   | Konsolidasyon route handler içinde çalıştırılmamalı       |
| Test               | Vitest + Playwright            | `service` katmanı saf olduğu için kolay test edilir       |

### Önemli mimari not

Konsolidasyon hesaplamaları ve ERP veri aktarımı gibi uzun süren işler API route
handler'ları içinde çalıştırılmamalıdır — sunucusuz ortamlarda zaman aşımı sınırı
vardır. Bu işler kuyruğa alınmalı, ayrı bir worker süreci tarafından yürütülmelidir.
`src/backend` katmanı bilerek framework'ten bağımsız tutulmuştur; o worker aynı
`service` dosyalarını değişiklik yapmadan kullanabilir.
