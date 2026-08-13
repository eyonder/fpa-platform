-- FixedAsset'i mevcut RLS setine katar (Scenario/BudgetLine/AuditLog/
-- ImportJob/Employee/CostCenter ile AYNI desen). VukAmortismanConfig
-- KASITLI OLARAK bu listede YOK — küresel referans veri (PayrollTaxConfig
-- gibi), tenant'a özel değil, tenantId kolonu bile yok.

ALTER TABLE "FixedAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FixedAsset" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "FixedAsset"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());

-- Not: fpa_app/fpa_bypass_rls rollerine GRANT gerekmiyor — ilk RLS
-- migration'ındaki `ALTER DEFAULT PRIVILEGES IN SCHEMA public ...` bunu
-- YENİ oluşturulan her tablo için otomatik kapsıyor (Faz 1'de doğrulandı).
