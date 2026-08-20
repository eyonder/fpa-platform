import { z } from "zod";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD biçiminde olmalı.");

export const cashFlowDirectionSchema = z.enum(["INFLOW", "OUTFLOW"]);

export const createCashFlowEventSchema = z.object({
  scenarioId: z.string().min(1, "scenarioId zorunludur."),
  dueDate: dateSchema,
  direction: cashFlowDirectionSchema,
  amount: z.number().positive("Tutar 0'dan büyük olmalı."),
  categoryId: z.string().min(1, "categoryId zorunludur."),
  counterparty: z.string().optional(),
  description: z.string().optional(),
  // Tahakkuk katmanına yumuşak referans — FK YOK (bkz. prisma/schema.prisma'daki
  // 14. bölüm notu). accrualScenarioId var olmayan bir Scenario'ya işaret
  // edebilir, burada doğrulanmaz.
  accrualScenarioId: z.string().optional(),
  accrualStartMonth: z.number().int().min(1).max(12).optional(),
  accrualSpreadMonths: z.number().int().positive().optional(),
});

export type CreateCashFlowEventInput = z.infer<typeof createCashFlowEventSchema>;

export const updateCashFlowEventSchema = createCashFlowEventSchema
  .omit({ scenarioId: true })
  .partial();

export type UpdateCashFlowEventInput = z.infer<typeof updateCashFlowEventSchema>;

export const listCashFlowEventsSchema = z.object({
  scenarioId: z.string().min(1, "scenarioId zorunludur."),
  status: z.enum(["PLANNED", "NEUTRALIZED", "CANCELLED"]).optional(),
});

export type ListCashFlowEventsQuery = z.infer<typeof listCashFlowEventsSchema>;
