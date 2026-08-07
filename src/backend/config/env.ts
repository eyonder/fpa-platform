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
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Ortam değişkenleri geçersiz: ${parsed.error.message}`);
}

export const env = parsed.data;
