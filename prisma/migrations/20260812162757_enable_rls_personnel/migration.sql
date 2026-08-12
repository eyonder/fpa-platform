-- Employee/EmployeeCompensation'ı mevcut RLS setine katar (Scenario/
-- BudgetLine/AuditLog/ImportJob ile aynı desen — bkz. ilk RLS migration'ındaki
-- get_current_tenant_id() / FORCE ROW LEVEL SECURITY notları).
-- PayrollTaxConfig KASITLI OLARAK bu listede YOK — küresel referans veri
-- (FxRate/BudgetCategory gibi), tenant'a özel değil.

ALTER TABLE "Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeCompensation" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Employee" FORCE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeCompensation" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Employee"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());

CREATE POLICY tenant_isolation ON "EmployeeCompensation"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());

-- Not: fpa_app/fpa_bypass_rls rollerine GRANT gerekmiyor — ilk RLS
-- migration'ındaki `ALTER DEFAULT PRIVILEGES IN SCHEMA public ...` bunu
-- YENİ oluşturulan her tablo için otomatik kapsıyor (Faz 1'de doğrulandı).
