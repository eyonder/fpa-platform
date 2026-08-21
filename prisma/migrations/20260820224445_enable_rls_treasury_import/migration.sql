-- TreasuryImportBatch'i mevcut RLS setine katar (CashFlowEvent/MappingConfig/
-- BankBalance/BankTransaction ile AYNI desen).

ALTER TABLE "TreasuryImportBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TreasuryImportBatch" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TreasuryImportBatch"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());

-- Not: fpa_app/fpa_bypass_rls rollerine GRANT gerekmiyor — ilk RLS
-- migration'ındaki `ALTER DEFAULT PRIVILEGES IN SCHEMA public ...` bunu
-- YENİ oluşturulan her tablo için otomatik kapsıyor.
