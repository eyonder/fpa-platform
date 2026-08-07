import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js kendi .env.local yüklemesini sadece `next dev`/`next build`
// çalışırken yapar; bu dosya CLI (`npx prisma ...`) için ayrıca yükler.
// Proje `.env` yerine `.env.local` kullanıyor (bkz. .env.example).
loadEnv({ path: ".env.local" });

/**
 * Prisma 7 yapılandırması. `schema.prisma`'daki `datasource.url` KALDIRILDI
 * (Prisma 7'de artık desteklenmiyor) — Migrate/Studio bağlantı URL'ini
 * buradan, uygulama çalışma zamanı ise `backend/core/prisma-client.ts`
 * içindeki `@prisma/adapter-pg` driver adapter'ından alır.
 *
 * `dotenv/config` importu `.env.local`'i CLI komutları için (örn.
 * `npx prisma migrate dev`) yükler — Next.js'in kendi `.env.local` yüklemesi
 * sadece `next dev`/`next build` çalışırken devreye girer, CLI'da girmez.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
