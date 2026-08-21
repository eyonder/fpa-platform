-- BudgetCategory artık tenant'a özel — projedeki iki-migration RLS ayrımının
-- ikinci yarısı (bkz. diğer *_enable_rls_* migration'ları). GRANT gerekmez:
-- ilk RLS migration'ındaki ALTER DEFAULT PRIVILEGES tüm yeni tabloları kapsar.
ALTER TABLE "BudgetCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BudgetCategory" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BudgetCategory"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());
