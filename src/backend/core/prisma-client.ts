import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "../config/env";
import { getGlobalStore } from "./global-store";
import { TenantContext } from "./tenant-context";

/**
 * Slug tipi id'lerimizle eşleşir (örn. "org-holding", "demo-tenant").
 * Postgres `SET LOCAL` bağlı parametre (bind parameter) ALMAZ, bu yüzden
 * tenantId'yi ham SQL'e yazmadan önce burada sıkı bir biçim kontrolü
 * yapılır — enjeksiyona karşı tek savunma budur.
 */
const TENANT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function assertValidTenantId(tenantId: string): void {
  if (!TENANT_ID_PATTERN.test(tenantId)) {
    throw new Error(`Geçersiz tenantId biçimi: ${JSON.stringify(tenantId)}`);
  }
}

/** PascalCase model adını (Prisma.ModelName) Prisma Client'ın camelCase
 * erişimcisine çevirir (ör. "BudgetLine" → "budgetLine"). */
function toClientModelKey(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * `getGlobalStore` ile sarmalı tekil (singleton) — bu proje Turbopack'in
 * Route Handler'lar ile Server Component'leri FARKLI modül paketlerinde
 * derlediği, gerçek ve yaşanmış bir hatayı `global-store.ts` ile çözdü (bkz.
 * o dosyadaki yorum ve `tenant-context.ts`); bir PrismaClient'ı da aynı
 * korumasız modül-seviyesi state olarak bırakmak, dev'de her hot-reload'da
 * yeni bir bağlantı havuzu açılmasına (veya iki ayrı kopyanın birbirinden
 * habersiz çalışmasına) yol açabilir.
 */
const basePrisma = getGlobalStore("prisma-base-client", () => {
  // KASITLI OLARAK `APP_DATABASE_URL` — tabloların owner'ı OLMAYAN, superuser
  // OLMAYAN `fpa_app` rolüne bağlanır. RLS'in gerçekten filtrelemesi için
  // şart: owner/superuser bağlantısı RLS'i her zaman atlar (bkz.
  // prisma/migrations/*_enable_rls/migration.sql'deki not).
  const adapter = new PrismaPg({ connectionString: env.APP_DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
});

/**
 * RLS'i BİLEREK atlayan, dar kapsamlı client — SADECE
 * `consolidation.service.ts` kullanmalıdır. O servis holding altındaki
 * BİRDEN ÇOK tenant'ın verisini TEK istekte okur; bu, RLS'in "bir seferde
 * tek tenant" (`SET LOCAL app.current_tenant_id`) varsayımıyla temelden
 * çelişir. Servis zaten kendi yetki kontrolünü (`requestingTenantId !==
 * parent.id` → `ForbiddenError`) veriye dokunmadan ÖNCE yapıyor —
 * `organization.repository.ts`'teki "Prisma+RLS'e geçilince BYPASSRLS'li dar
 * kapsamlı bir servis rolü gerekir" notunun karşılığı budur. Rol,
 * `prisma/migrations/*_enable_rls/migration.sql` içinde oluşturulur.
 */
export const prismaBypassRls = getGlobalStore("prisma-bypass-rls-client", () => {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL_BYPASS_RLS });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
});

/**
 * Uygulamanın kullanacağı ANA client. Her sorguyu (`$allOperations`) sarmalar:
 *  - Aktif bir `TenantContext` YOKSA (login, session çözme gibi tenant-öncesi
 *    sorgular) sorgu OLDUĞU GİBİ çalışır — bu tablolar zaten RLS'e tabi değil
 *    (User/Membership/Session/PasswordResetToken/Tenant/FxRate/BudgetCategory).
 *  - Bağlam VARSA sorgu, ilk ifadesi `SET LOCAL app.current_tenant_id` olan
 *    bir mini `$transaction` içine alınır — RLS politikaları bunu okur.
 *
 * ÖNEMLİ SINIR: bu otomatik sarmalama, ZATEN açık olan bir `$transaction`
 * içine (ör. `budgetLineService.bulkUpsert`) İÇ İÇE GİREMEZ — Postgres'te bir
 * transaction içinde ikinci bir transaction açılamaz. O tek çok-adımlı yazma
 * yolu, `SET LOCAL`'i kendi transaction'ının ilk ifadesi olarak MANUEL
 * çalıştırıp tüm repository çağrılarını aynı `tx` client'ıyla yapar (bkz.
 * `budget-line.service.ts`teki yorum) — bu extension'ın kapsamı SADECE
 * tek-atım (standalone) sorgulardır.
 */
export const prisma = basePrisma.$extends({
  query: {
    $allOperations: async ({ model, operation, args, query }) => {
      const context = TenantContext.get();

      if (!context || !model) {
        return query(args);
      }

      assertValidTenantId(context.tenantId);
      const tenantId = context.tenantId;

      return basePrisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}';`);

        const txBoundClient = tx as unknown as Record<
          string,
          Record<string, (queryArgs: unknown) => Promise<unknown>>
        >;
        return txBoundClient[toClientModelKey(model)][operation](args);
      });
    },
  },
});

export default prisma;

/**
 * Repository fonksiyonlarının ikinci (opsiyonel) parametresi olarak kabul
 * ettiği tip: ya normal `prisma` (extended, tek-atım sorgular için) ya da
 * bir `$transaction` callback'inin `tx`'i. İkisi de aynı model
 * erişimcilerini (`.scenario`, `.budgetLine`, ...) sunar — sadece
 * `$transaction`/`$extends` gibi client-seviyesi metodlar hariç tutulur.
 */
export type PrismaClientOrTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * `prisma`, `PrismaClientOrTx` tipine sarmalı — repository fonksiyonlarının
 * varsayılan parametre değeri budur (`client: PrismaClientOrTx =
 * prismaAsTxClient`). Runtime'da BİREBİR AYNI nesne (`basePrisma.$extends(...)`);
 * sadece TypeScript'in `$extends` sonrası ürettiği son derece özelleşmiş
 * (`Exact<>` tabanlı) generic argüman tipleri ile buradaki basit
 * `Omit<PrismaClient, ...>` arayüzü KOZMETİK olarak uyuşmadığı için (aynı
 * model/method'lar, aynı gerçek argüman şekilleri — sadece TS'in iç generic
 * kısıtı farklı) tek bir noktada köprüleniyor.
 */
export const prismaAsTxClient = prisma as unknown as PrismaClientOrTx;

/**
 * `budgetLineService.bulkUpsert` gibi ÇOK ADIMLI, tenant'a bağlı yazma
 * akışları İÇİNDİR. `prisma`'nın otomatik `$allOperations` sarmalaması
 * ZATEN açık bir transaction'a İÇ İÇE GİREMEZ (bkz. `prisma` yorumundaki
 * not) — bu yüzden bu tür akışlar `basePrisma` (extend EDİLMEMİŞ, yani
 * kendi model çağrıları TEKRAR sarmalanmayan) üzerinde KENDİ
 * transaction'larını açar, `SET LOCAL`'i İLK ifade olarak MANUEL çalıştırır
 * ve tüm repository çağrılarını dönen `tx` ile yapar.
 *
 * Kullanım: her repository metodu ikinci parametre olarak
 * `client: PrismaClientOrTx = prisma` alır; transaction içindeyken çağıran
 * bu `tx`'i geçirir, aksi halde varsayılan (`prisma`, extension'lı) kullanılır.
 */
export async function withTenantTransaction<T>(
  tenantId: string,
  callback: (tx: PrismaClientOrTx) => Promise<T>,
): Promise<T> {
  assertValidTenantId(tenantId);

  return basePrisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantId}';`);
    return callback(tx);
  });
}
