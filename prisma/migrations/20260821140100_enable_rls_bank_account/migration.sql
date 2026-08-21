-- Projedeki iki-migration RLS ayrımının ikinci yarısı. GRANT gerekmez:
-- ilk RLS migration'ındaki ALTER DEFAULT PRIVILEGES tüm yeni tabloları kapsar.
ALTER TABLE "BankAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankAccount" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BankAccount"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());
