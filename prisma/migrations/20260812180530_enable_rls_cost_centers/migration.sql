-- CostCenter/AllocationKey/AllocationKeyMember/ExpenseEntry'yi mevcut RLS
-- setine katar (Scenario/BudgetLine/AuditLog/ImportJob/Employee ile AYNI
-- desen — bkz. ilk RLS migration'ındaki get_current_tenant_id() / FORCE ROW
-- LEVEL SECURITY notları).

ALTER TABLE "CostCenter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AllocationKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AllocationKeyMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseEntry" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "CostCenter" FORCE ROW LEVEL SECURITY;
ALTER TABLE "AllocationKey" FORCE ROW LEVEL SECURITY;
ALTER TABLE "AllocationKeyMember" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseEntry" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "CostCenter"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());

CREATE POLICY tenant_isolation ON "AllocationKey"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());

CREATE POLICY tenant_isolation ON "AllocationKeyMember"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());

CREATE POLICY tenant_isolation ON "ExpenseEntry"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());

-- Not: fpa_app/fpa_bypass_rls rollerine GRANT gerekmiyor — ilk RLS
-- migration'ındaki `ALTER DEFAULT PRIVILEGES IN SCHEMA public ...` bunu
-- YENİ oluşturulan her tablo için otomatik kapsıyor (Faz 1'de doğrulandı).
