import { z } from "zod";

/** Görüntüleme para birimi — SUNUM amaçlı, saklanan veriyi değiştirmez
 * (bkz. backend/modules/fx/display-currency.ts). */
export const displayCurrencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Para birimi 3 harfli ISO kodu olmalı.")
  .optional();

export const listBudgetLinesSchema = z.object({
  scenarioId: z.string().min(1, "scenarioId zorunludur."),
  displayCurrency: displayCurrencySchema,
});

export type ListBudgetLinesQuery = z.infer<typeof listBudgetLinesSchema>;

const budgetLineInputSchema = z.object({
  categoryId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  amount: z.number().finite("Tutar geçerli bir sayı olmalı."),
});

export const bulkUpsertBudgetLinesSchema = z.object({
  scenarioId: z.string().min(1, "scenarioId zorunludur."),
  lines: z
    .array(budgetLineInputSchema)
    .min(1, "En az bir satır göndermelisiniz.")
    .max(500, "Tek istekte en fazla 500 hücre güncellenebilir."),
});

export type BulkUpsertBudgetLinesInput = z.infer<typeof bulkUpsertBudgetLinesSchema>;
