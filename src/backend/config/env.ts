import { z } from "zod";

/**
 * Ortam değişkenleri uygulama açılırken doğrulanır.
 * Eksik bir değişken varsa uygulama sessizce yanlış çalışmak yerine hemen durur.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Ortam değişkenleri geçersiz: ${parsed.error.message}`);
}

export const env = parsed.data;
