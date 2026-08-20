-- SalesBillingMilestone'ı mevcut RLS setine katar (SalesOpportunity ile AYNI desen).

ALTER TABLE "SalesBillingMilestone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesBillingMilestone" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "SalesBillingMilestone"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());

-- Not: fpa_app/fpa_bypass_rls rollerine GRANT gerekmiyor — ilk RLS
-- migration'ındaki `ALTER DEFAULT PRIVILEGES IN SCHEMA public ...` bunu
-- YENİ oluşturulan her tablo için otomatik kapsıyor.
