import { z } from "zod";

export const consolidateSchema = z
  .object({
    parentOrganizationId: z.string().min(1, "parentOrganizationId zorunludur."),
    fiscalYear: z.coerce.number().int().min(2000).max(2100),
    periodStart: z.coerce.number().int().min(1).max(12),
    periodEnd: z.coerce.number().int().min(1).max(12),
    scenarioKind: z.enum(["BUDGET", "ACTUAL", "FORECAST"]).default("BUDGET"),
    /** YYYY-MM-DD. Boş bırakılırsa bugünün tarihi kullanılır. */
    asOfDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "asOfDate YYYY-MM-DD formatında olmalı.")
      .optional(),
  })
  .refine((v) => v.periodStart <= v.periodEnd, {
    message: "periodStart, periodEnd'den büyük olamaz.",
    path: ["periodStart"],
  });

export type ConsolidateQuery = z.infer<typeof consolidateSchema>;
