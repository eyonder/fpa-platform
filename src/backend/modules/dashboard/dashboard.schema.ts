import { z } from "zod";

export const dashboardSummarySchema = z.object({
  budgetScenarioId: z.string().min(1, "budgetScenarioId zorunludur."),
  actualScenarioId: z.string().min(1, "actualScenarioId zorunludur."),
  fiscalYear: z.coerce.number().int().min(2000).max(2100),
  /** Boş bırakılırsa: mali yıl bugünkü yılsa bugünün ayı, geçmiş yılsa 12, gelecek yılsa 0. */
  asOfMonth: z.coerce.number().int().min(0).max(12).optional(),
  categoryType: z.enum(["EXPENSE", "INCOME"]).optional().default("EXPENSE"),
  displayCurrency: z
    .string()
    .regex(/^[A-Z]{3}$/, "Para birimi 3 harfli ISO kodu olmalı.")
    .optional(),
});

export type DashboardSummaryQuery = z.infer<typeof dashboardSummarySchema>;
