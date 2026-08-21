-- BudgetCategory KÜRESEL -> TENANT'A ÖZEL.
--
-- Gerçek bir şirketin hesap planı (149 THP alt hesabı) yüklenirken küresel
-- tasarım tıkandı: küresel bir tabloya eklemek bir tenant'ın hesap planını
-- diğerlerine sızdırırdı. `code`, tenant içinde kararlı anahtardır ve
-- konsolidasyonun tenant'lar arası eşleme yaptığı alandır.
--
-- Veri taşıma sırası ÖNEMLİ: klonlar ÖNCE yaratılır, FK'ler SONRA taşınır,
-- eski küresel satırlar EN SON silinir — her adımda FK bütünlüğü korunur.

-- 1. Yeni kolonlar (önce nullable, veri taşınabilsin diye)
ALTER TABLE "BudgetCategory" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "BudgetCategory" ADD COLUMN "code" TEXT;

-- 2. Mevcut küresel kategorilerin kodu = eski id ("cat-gelir" vb.)
UPDATE "BudgetCategory" SET "code" = "id" WHERE "code" IS NULL;

-- 3. Her tenant için birer klon (id = "<tenantId>:<code>")
INSERT INTO "BudgetCategory" ("id", "tenantId", "code", "name", "type", "sortOrder")
SELECT t."id" || ':' || c."code", t."id", c."code", c."name", c."type", c."sortOrder"
FROM "Tenant" t
CROSS JOIN "BudgetCategory" c
WHERE c."tenantId" IS NULL;

-- 4. Referansları tenant'a özel klonlara taşı (her tablo tenantId taşıyor)
UPDATE "BudgetLine"    SET "categoryId" = "tenantId" || ':' || "categoryId" WHERE "categoryId" NOT LIKE '%:%';
UPDATE "AuditLog"      SET "categoryId" = "tenantId" || ':' || "categoryId" WHERE "categoryId" NOT LIKE '%:%';
UPDATE "ExpenseEntry"  SET "categoryId" = "tenantId" || ':' || "categoryId" WHERE "categoryId" NOT LIKE '%:%';
UPDATE "CashFlowEvent" SET "categoryId" = "tenantId" || ':' || "categoryId" WHERE "categoryId" NOT LIKE '%:%';
UPDATE "MappingConfig" SET "categoryId" = "tenantId" || ':' || "categoryId" WHERE "categoryId" NOT LIKE '%:%';

-- 5. Artık referanssız kalan küresel satırları sil
DELETE FROM "BudgetCategory" WHERE "tenantId" IS NULL;

-- 6. Kısıtları sıkılaştır
ALTER TABLE "BudgetCategory" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "BudgetCategory" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "BudgetCategory"
  ADD CONSTRAINT "BudgetCategory_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "BudgetCategory_tenantId_code_key" ON "BudgetCategory"("tenantId", "code");
CREATE INDEX "BudgetCategory_tenantId_idx" ON "BudgetCategory"("tenantId");
