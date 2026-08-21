import { z } from "zod";

import { cashFlowDirectionSchema } from "./treasury.schema";

/**
 * What-If isteğinin doğrulaması. TEK etiketli birleşim (`kind`) — istenen her
 * senaryo ayrı bir uç değil, bu birleşimin bir varyantıdır.
 */

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD biçiminde olmalı.");

const projectionSourceSchema = z.enum([
  "MANUAL",
  "THP_IMPORT",
  "BUDGET_DERIVED",
  "SALES",
  "PIPELINE",
  "CAPEX",
  "PAYROLL",
  "SIMULATION",
]);

const rowFilterSchema = z.object({
  direction: cashFlowDirectionSchema.optional(),
  categoryIds: z.array(z.string().min(1)).max(50).optional(),
  sources: z.array(projectionSourceSchema).max(7).optional(),
  counterpartyContains: z.string().min(1).max(200).optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
});

// Kaydırma sınırı ±365: 90 günlük bir pencerede bundan büyük bir kaydırma
// satırı zaten pencere dışına atar, "sonsuz ötele" anlamlı bir senaryo değil.
const shiftDaysSchema = z.number().int().min(-365).max(365);

export const treasuryAdjustmentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ADD_EVENT"),
    id: z.string().min(1),
    label: z.string().min(1, "Etiket zorunludur.").max(200),
    direction: cashFlowDirectionSchema,
    amount: z.number().positive("Tutar 0'dan büyük olmalı."),
    date: dateSchema,
    categoryId: z.string().min(1).optional(),
  }),
  z.object({
    kind: z.literal("SPOT_LOAN"),
    id: z.string().min(1),
    label: z.string().min(1, "Etiket zorunludur.").max(200),
    principal: z.number().positive("Anapara 0'dan büyük olmalı."),
    drawDate: dateSchema,
    termDays: z.number().int().min(1).max(3650),
    repaymentAmount: z.number().positive().optional(),
    annualRatePct: z.number().min(0).max(500).optional(),
  }),
  z.object({
    kind: z.literal("SHIFT_EVENT"),
    id: z.string().min(1),
    targetRowId: z.string().min(1),
    shiftDays: shiftDaysSchema,
  }),
  z.object({
    kind: z.literal("SHIFT_BY_FILTER"),
    id: z.string().min(1),
    filter: rowFilterSchema,
    shiftDays: shiftDaysSchema,
  }),
  z.object({
    kind: z.literal("SCALE_BY_FILTER"),
    id: z.string().min(1),
    filter: rowFilterSchema,
    // 0 = satırı kaldır. Üst sınır 100x — daha büyüğü veri girişi hatasıdır.
    factor: z.number().min(0).max(100),
  }),
  z.object({
    kind: z.literal("PAYROLL_RAISE"),
    id: z.string().min(1),
    percent: z.number().min(-100).max(500),
    effectiveFrom: dateSchema,
  }),
]);

const includeDerivedSchema = z.object({
  sales: z.boolean().optional(),
  capex: z.boolean().optional(),
  payroll: z.boolean().optional(),
  pipeline: z.boolean().optional(),
});

const displayCurrencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Para birimi 3 harfli ISO kodu olmalı.")
  .optional();

export const treasuryProjectionQuerySchema = z.object({
  scenarioId: z.string().min(1, "scenarioId zorunludur."),
  displayCurrency: displayCurrencySchema,
  startDate: dateSchema.optional(),
  horizonDays: z.coerce.number().int().min(1).max(365).optional(),
  granularity: z.enum(["DAY", "WEEK"]).optional(),
  // GET'te querystring'den geldiği için "true"/"false" metinleri kabul edilir.
  includeSales: z.enum(["true", "false"]).optional(),
  includeCapex: z.enum(["true", "false"]).optional(),
  includePayroll: z.enum(["true", "false"]).optional(),
  includePipeline: z.enum(["true", "false"]).optional(),
});

export type TreasuryProjectionQuery = z.infer<typeof treasuryProjectionQuerySchema>;

export const treasurySimulationSchema = z.object({
  scenarioId: z.string().min(1, "scenarioId zorunludur."),
  displayCurrency: displayCurrencySchema,
  startDate: dateSchema.optional(),
  horizonDays: z.number().int().min(1).max(365).optional(),
  granularity: z.enum(["DAY", "WEEK"]).optional(),
  includeDerived: includeDerivedSchema.optional(),
  adjustments: z
    .array(treasuryAdjustmentSchema)
    .max(50, "Tek seferde en fazla 50 düzeltme uygulanabilir."),
});

export type TreasurySimulationRequest = z.infer<typeof treasurySimulationSchema>;
