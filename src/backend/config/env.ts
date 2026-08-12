import { z } from "zod";

/**
 * Ortam değişkenleri uygulama açılırken doğrulanır.
 * Eksik bir değişken varsa uygulama sessizce yanlış çalışmak yerine hemen durur.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // NOT: `DATABASE_URL` burada YOK — o sadece `prisma.config.ts` (CLI:
  // migrate/studio/seed) tarafından, tabloların OWNER'ı olan/superuser
  // rolle bağlanmak için kullanılır. Uygulama çalışma zamanı KASITLI olarak
  // farklı, RLS'e tabi bir rol kullanır (bkz. APP_DATABASE_URL) — aksi halde
  // (owner veya superuser ile bağlanılırsa) RLS politikaları sessizce hiçbir
  // şey filtrelemez. Ayrıntı: prisma/migrations/*_enable_rls/migration.sql.
  APP_DATABASE_URL: z.string().url(),
  // Sadece consolidation.service.ts kullanır: RLS'i atlayan (BYPASSRLS), dar
  // kapsamlı bir Postgres rolüne bağlanır — bkz. prisma/migrations/*_enable_rls
  // ve backend/core/prisma-client.ts. Diğer her şey normal `prisma` client'ı
  // (RLS'e tabi) kullanmalı.
  DATABASE_URL_BYPASS_RLS: z.string().url(),
  REDIS_URL: z.string().url().optional(),

  // TOTP MFA sırlarını (secret) DB'de düz metin tutmamak için — bkz.
  // backend/core/crypto.ts. 32 byte, base64. Kaybedilir/değiştirilirse
  // ENROLLI kullanıcıların şifreli sırları çözülemez hâle gelir (yeniden
  // enroll gerekir) — üretimde bir secret manager'da saklanmalı.
  MFA_ENCRYPTION_KEY: z.string().min(32),

  // İkisi de opsiyonel: sadece biri (ya da hiçbiri) verilirse gerçek e-posta
  // gönderimi devre dışı kalır ve backend/core/email.ts sessizce
  // logger.info fallback'ine döner (yerel geliştirmede SendGrid şart değil).
  SENDGRID_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Ortam değişkenleri geçersiz: ${parsed.error.message}`);
}

export const env = parsed.data;
