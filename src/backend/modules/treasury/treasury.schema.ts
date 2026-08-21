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

// ----------------------------------------------------
// THP (Tek Düzen Hesap Planı) eşleştirme kuralları (Faz 4.2)
// ----------------------------------------------------

export const mappingLayerSchema = z.enum(["CASH", "ACCRUAL"]);

// `layer`/`isActive` KASITLI `.optional()` — `.default()` DEĞİL: z.infer,
// `.default()` alanlarını çıktıda ZORUNLU yapar, bu da shared/types/treasury.ts'teki
// (frontend'in de kullandığı) `CreateMappingConfigInput` arayüzüyle
// (opsiyonel) yapısal olarak UYUŞMAZ — bkz. sales.schema.ts'teki AYNI
// tuzaktan kaçınma disiplini (CreateSalesOpportunityInput). Varsayılan değer
// repository katmanında (`input.layer ?? "CASH"`) uygulanır.
export const createMappingConfigSchema = z.object({
  accountCode: z
    .string()
    .min(1, "Hesap kodu zorunludur.")
    .max(20, "Hesap kodu en fazla 20 karakter olabilir."),
  accountName: z.string().min(1, "Hesap adı zorunludur."),
  categoryId: z.string().min(1, "categoryId zorunludur."),
  direction: cashFlowDirectionSchema,
  layer: mappingLayerSchema.optional(),
  defaultTermDays: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  note: z.string().optional(),
});

export type CreateMappingConfigInput = z.infer<typeof createMappingConfigSchema>;

export const updateMappingConfigSchema = createMappingConfigSchema.partial();

export type UpdateMappingConfigInput = z.infer<typeof updateMappingConfigSchema>;
