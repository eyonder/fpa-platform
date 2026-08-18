import { z } from "zod";

export const cashFlowQuerySchema = z
  .object({
    scenarioId: z.string().min(1, "scenarioId zorunludur."),
    periodStart: z.coerce.number().int().min(1).max(12),
    periodEnd: z.coerce.number().int().min(1).max(12),
  })
  .refine((v) => v.periodStart <= v.periodEnd, {
    message: "periodStart, periodEnd'den büyük olamaz.",
    path: ["periodStart"],
  });

export type CashFlowQuery = z.infer<typeof cashFlowQuerySchema>;
