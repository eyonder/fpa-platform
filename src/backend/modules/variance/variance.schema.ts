import { z } from "zod";

export const compareVarianceSchema = z
  .object({
    budgetScenarioId: z.string().min(1, "budgetScenarioId zorunludur."),
    actualScenarioId: z.string().min(1, "actualScenarioId zorunludur."),
    periodStart: z.coerce.number().int().min(1).max(12),
    periodEnd: z.coerce.number().int().min(1).max(12),
    displayCurrency: z
      .string()
      .regex(/^[A-Z]{3}$/, "Para birimi 3 harfli ISO kodu olmalı.")
      .optional(),
  })
  .refine((v) => v.periodStart <= v.periodEnd, {
    message: "periodStart, periodEnd'den büyük olamaz.",
    path: ["periodStart"],
  });

export type CompareVarianceQuery = z.infer<typeof compareVarianceSchema>;
