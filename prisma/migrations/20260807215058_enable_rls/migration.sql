-- Row-Level Security (satır düzeyinde güvenlik) kurulumu.
--
-- ÖNEMLİ (yerel Docker kurulumuna özgü bir tuzak): `docker-compose.yml`'deki
-- `postgres:16` imajı, POSTGRES_USER olarak verdiğimiz "fpa" rolünü
-- SUPERUSER olarak oluşturur (initdb bootstrap rolü budur). Postgres'te
-- SUPERUSER'lar RLS'i HER ZAMAN atlar — `FORCE ROW LEVEL SECURITY` bile bunu
-- değiştiremez (FORCE sadece "owner ama superuser değil" durumunu etkiler).
-- Bu yüzden uygulamanın gerçek çalışma zamanı bağlantısı (`APP_DATABASE_URL`)
-- "fpa" ile AYNI ROL OLAMAZ — aksi halde RLS politikaları hiçbir şeyi
-- filtrelemez, sessizce "çalışıyormuş gibi" görünür. Bu yüzden burada üç
-- ayrı rol tanımlanır:
--   - fpa            (superuser, sadece migration/seed — DATABASE_URL)
--   - fpa_app         (ne owner ne superuser, RLS'e tabi — APP_DATABASE_URL)
--   - fpa_bypass_rls  (BYPASSRLS, sadece consolidation — DATABASE_URL_BYPASS_RLS)

-- ----------------------------------------------------
-- 1. Uygulama rolleri
-- ----------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fpa_app') THEN
    CREATE ROLE fpa_app LOGIN PASSWORD 'fpa_app' NOSUPERUSER NOBYPASSRLS;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fpa_bypass_rls') THEN
    CREATE ROLE fpa_bypass_rls LOGIN PASSWORD 'fpa_bypass_rls' NOSUPERUSER BYPASSRLS;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE fpa TO fpa_app, fpa_bypass_rls;
GRANT USAGE ON SCHEMA public TO fpa_app, fpa_bypass_rls;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fpa_app, fpa_bypass_rls;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fpa_app, fpa_bypass_rls;

-- Bu migration'dan SONRA eklenecek tablolar/sekanslar için de aynı hakları
-- otomatik ver (owner "fpa" olarak çalıştırılan gelecekteki migration'lar).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fpa_app, fpa_bypass_rls;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO fpa_app, fpa_bypass_rls;

-- ----------------------------------------------------
-- 2. RLS yardımcı fonksiyonu
-- ----------------------------------------------------

CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS TEXT AS $$
BEGIN
  -- İkinci parametre (missing_ok = true): `app.current_tenant_id` HİÇ
  -- set edilmemişse hata fırlatmak yerine NULL döner. Politikalar
  -- `tenantId = get_current_tenant_id()` biçiminde olduğu için NULL bir
  -- sütun değerine ASLA eşit olmaz (üç değerli mantık) — yani bağlam
  -- yoksa sorgu 0 satır döner: KAPALI-HATA (fail closed), AÇIK-HATA değil.
  RETURN current_setting('app.current_tenant_id', true);
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------
-- 3. RLS'in aktif edilmesi — SADECE gerçekten tenant'a bölünmüş tablolar
-- ----------------------------------------------------
-- User/Membership/Session/PasswordResetToken (tenant bilinmeden ÖNCE
-- sorgulanır) ve Tenant/FxRate/BudgetCategory (küresel referans) BİLEREK
-- dışarıda bırakıldı.

ALTER TABLE "Scenario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BudgetLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImportJob" ENABLE ROW LEVEL SECURITY;

-- FORCE: tablo owner'ı (fpa) SUPERUSER olduğu için bu dört tabloda pratikte
-- etkisizdir (bkz. yukarıdaki not) — ama gerçek çalışma zamanı zaten owner
-- OLMAYAN `fpa_app` rolüyle bağlandığı için asıl izolasyon zaten sağlanıyor.
-- FORCE, ileride owner değişirse/roller sadeleşirse ikinci bir savunma
-- hattı olarak kalsın diye eklendi.
ALTER TABLE "Scenario" FORCE ROW LEVEL SECURITY;
ALTER TABLE "BudgetLine" FORCE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ImportJob" FORCE ROW LEVEL SECURITY;

-- ----------------------------------------------------
-- 4. Politikalar
-- ----------------------------------------------------

CREATE POLICY tenant_isolation ON "Scenario"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());

CREATE POLICY tenant_isolation ON "BudgetLine"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());

CREATE POLICY tenant_isolation ON "ImportJob"
  FOR ALL
  USING ("tenantId" = get_current_tenant_id())
  WITH CHECK ("tenantId" = get_current_tenant_id());

-- AuditLog BİLEREK sadece SELECT+INSERT politikası alır — UPDATE/DELETE
-- politikası YOKTUR. RLS aktifken bir komut için izin veren politika yoksa
-- Postgres o komutu VARSAYILAN OLARAK REDDEDER — yani audit satırları artık
-- veritabanı seviyesinde de değiştirilemez/silinemez (audit.repository.ts'in
-- API yüzeyinde zaten uyguladığı "sadece ekle" kuralının DB karşılığı).
CREATE POLICY tenant_select ON "AuditLog"
  FOR SELECT
  USING ("tenantId" = get_current_tenant_id());

CREATE POLICY tenant_insert ON "AuditLog"
  FOR INSERT
  WITH CHECK ("tenantId" = get_current_tenant_id());
