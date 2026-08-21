-- Banka hesabı tablosu — Hazine MVP kapsam kesintileri #1 (tek hesap) ve
-- #2 (tek para birimi) GERİ ALINIYOR. Gerçek bir müşteri bakiye tablosu
-- 9 banka × 3 para birimi getirdi; tek satırlık BankBalance yetmiyor.
--
-- Plan'daki ileri yol birebir: BankAccount ekle -> NULLABLE bankAccountId ->
-- mevcut satırları varsayılan bir hesaba taşı -> ZORUNLU yap.

CREATE TABLE "BankAccount" (
  "id"              TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "bankName"        TEXT NOT NULL,
  "currency"        TEXT NOT NULL,
  "iban"            TEXT,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"       INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BankAccount"
  ADD CONSTRAINT "BankAccount_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "BankAccount_tenantId_bankName_currency_key"
  ON "BankAccount"("tenantId", "bankName", "currency");
CREATE INDEX "BankAccount_tenantId_idx" ON "BankAccount"("tenantId");

-- 1. Nullable kolonlar
ALTER TABLE "BankBalance"     ADD COLUMN "bankAccountId" TEXT;
ALTER TABLE "BankTransaction" ADD COLUMN "bankAccountId" TEXT;

-- 2. Verisi OLAN her tenant için varsayılan hesap (tenant'ın kendi para
--    biriminde) — mevcut satırların hepsi zaten o para birimindeydi.
INSERT INTO "BankAccount" ("id", "tenantId", "bankName", "currency", "sortOrder", "updatedAt")
SELECT DISTINCT t."id" || ':default', t."id", 'Banka (varsayılan)', t."baseCurrency", 0, CURRENT_TIMESTAMP
FROM "Tenant" t
WHERE EXISTS (SELECT 1 FROM "BankBalance" b WHERE b."tenantId" = t."id")
   OR EXISTS (SELECT 1 FROM "BankTransaction" x WHERE x."tenantId" = t."id");

-- 3. Mevcut satırları varsayılan hesaba bağla
UPDATE "BankBalance"     SET "bankAccountId" = "tenantId" || ':default' WHERE "bankAccountId" IS NULL;
UPDATE "BankTransaction" SET "bankAccountId" = "tenantId" || ':default' WHERE "bankAccountId" IS NULL;

-- 4. Zorunlu yap + FK + index
ALTER TABLE "BankBalance"     ALTER COLUMN "bankAccountId" SET NOT NULL;
ALTER TABLE "BankTransaction" ALTER COLUMN "bankAccountId" SET NOT NULL;

ALTER TABLE "BankBalance"
  ADD CONSTRAINT "BankBalance_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTransaction"
  ADD CONSTRAINT "BankTransaction_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "BankBalance_bankAccountId_idx"     ON "BankBalance"("bankAccountId");
CREATE INDEX "BankTransaction_bankAccountId_idx" ON "BankTransaction"("bankAccountId");

-- 5. "Günde tek fotoğraf" kısıtı artık HESAP başına
DROP INDEX "BankBalance_tenantId_asOfDate_key";
CREATE UNIQUE INDEX "BankBalance_tenantId_bankAccountId_asOfDate_key"
  ON "BankBalance"("tenantId", "bankAccountId", "asOfDate");
