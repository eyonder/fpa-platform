-- Hazine (Treasury) tablolarını mevcut RLS setine katar (Scenario/BudgetLine/
-- AuditLog/ImportJob/.../SalesOpportunity ile AYNI desen). BudgetCategory
-- KASITLI OLARAK bu listede YOK — küresel referans veri, tenant'a özel değil.

ALTER TABLE "CashFlowEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashFlowEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CashFlowEvent"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());

ALTER TABLE "MappingConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MappingConfig" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "MappingConfig"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());

ALTER TABLE "BankBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankBalance" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BankBalance"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());

ALTER TABLE "BankTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankTransaction" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BankTransaction"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());

-- Not: fpa_app/fpa_bypass_rls rollerine GRANT gerekmiyor — ilk RLS
-- migration'ındaki `ALTER DEFAULT PRIVILEGES IN SCHEMA public ...` bunu
-- YENİ oluşturulan her tablo için otomatik kapsıyor.
