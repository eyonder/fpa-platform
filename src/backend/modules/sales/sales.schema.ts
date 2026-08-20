import { z } from "zod";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD biçiminde olmalı.");

export const salesOpportunityStageSchema = z.enum([
  "LEAD",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
]);

// Yeni/düzenlenen bir fırsat SADECE açık bir aşamada oluşturulabilir —
// WON/LOST'a geçiş yalnızca `close` uç noktasından, closedAt damgasıyla
// birlikte olur (bkz. sales-opportunity.service.ts).
const openStageSchema = z.enum(["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION"]);

export const createSalesOpportunitySchema = z.object({
  customerName: z.string().min(1, "Müşteri adı zorunludur."),
  dealName: z.string().min(1, "Fırsat adı zorunludur."),
  expectedValue: z.number().positive("Tutar 0'dan büyük olmalı."),
  expectedCloseDate: dateSchema,
  stage: openStageSchema.default("LEAD"),
  // Herhangi bir aşamada geçerlidir — FixedAsset'in leasehold-only override
  // kısıtının AKSİNE burada kategori bazlı bir kısıt yoktur.
  winProbabilityOverride: z.number().min(0).max(1).optional(),
});

export type CreateSalesOpportunityInput = z.infer<typeof createSalesOpportunitySchema>;

export const updateSalesOpportunitySchema = z.object({
  customerName: z.string().min(1).optional(),
  dealName: z.string().min(1).optional(),
  expectedValue: z.number().positive().optional(),
  expectedCloseDate: dateSchema.optional(),
  stage: openStageSchema.optional(),
  winProbabilityOverride: z.number().min(0).max(1).optional(),
});

export type UpdateSalesOpportunityInput = z.infer<typeof updateSalesOpportunitySchema>;

export const listSalesOpportunitiesSchema = z.object({
  stage: salesOpportunityStageSchema.optional(),
  // "true" -> sadece açık (LEAD/QUALIFIED/PROPOSAL/NEGOTIATION) aşamalar.
  open: z.enum(["true", "false"]).optional(),
});

export type ListSalesOpportunitiesQuery = z.infer<typeof listSalesOpportunitiesSchema>;

export const closeSalesOpportunitySchema = z.object({
  outcome: z.enum(["WON", "LOST"]),
});

export type CloseSalesOpportunityInput = z.infer<typeof closeSalesOpportunitySchema>;

export const salesForecastScenarioSchema = z.object({
  scenarioId: z.string().min(1, "scenarioId zorunludur."),
});

export type SalesForecastScenarioInput = z.infer<typeof salesForecastScenarioSchema>;

const billingMilestoneSchema = z.object({
  billingDate: dateSchema,
  amount: z.number().positive("Tutar 0'dan büyük olmalı."),
});

// Toplamın fırsatın expectedValue'suna eşit olması burada DEĞİL, servis
// katmanında doğrulanır (bkz. sales-opportunity.service.ts#assertMilestonesSumMatches)
// — hedef bu fırsata özgü, DB'den okunan bir değer, Zod `.refine()` ile ifade
// EDİLEMEZ. `.min(1)` YOK: boş liste WON'a kapatılana kadar geçerli bir
// "henüz planlanmadı" durumudur (bkz. close()).
export const setBillingMilestonesSchema = z.object({
  milestones: z.array(billingMilestoneSchema),
});

export type SetBillingMilestonesInput = z.infer<typeof setBillingMilestonesSchema>;
