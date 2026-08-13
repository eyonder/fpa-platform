import { z } from "zod";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD biçiminde olmalı.");

export const fixedAssetCategorySchema = z.enum([
  "BUILDINGS",
  "MACHINERY_EQUIPMENT",
  "VEHICLES",
  "FURNITURE_FIXTURES",
  "COMPUTER_HARDWARE",
  "LEASEHOLD_IMPROVEMENTS",
]);

const cashFlowProjectionEntrySchema = z.object({
  year: z.number().int().min(1, "Yıl en az 1 olmalı."),
  // İşaretli: bir yıl net nakit ÇIKIŞI da olabilir (ör. büyük bakım/revizyon).
  amount: z.number().finite("Tutar geçerli bir sayı olmalı."),
});

export const createFixedAssetSchema = z.object({
  assetName: z.string().min(1, "Varlık adı zorunludur."),
  category: fixedAssetCategorySchema,
  acquisitionDate: dateSchema,
  baseValue: z.number().positive("Tutar 0'dan büyük olmalı."),
  usefulLifeYearsOverride: z.number().int().positive().optional(),
  cashFlowProjection: z
    .array(cashFlowProjectionEntrySchema)
    .max(60, "En fazla 60 yıllık nakit akışı girilebilir."),
  discountRate: z
    .number()
    .min(0, "İskonto oranı negatif olamaz.")
    .max(1, "İskonto oranı 1'i (%100) geçemez."),
  description: z.string().optional(),
});

export type CreateFixedAssetInput = z.infer<typeof createFixedAssetSchema>;

export const updateFixedAssetSchema = createFixedAssetSchema.partial();

export type UpdateFixedAssetInput = z.infer<typeof updateFixedAssetSchema>;

export const listFixedAssetsSchema = z.object({
  category: fixedAssetCategorySchema.optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]).optional(),
});

export type ListFixedAssetsQuery = z.infer<typeof listFixedAssetsSchema>;

export const rejectFixedAssetSchema = z.object({
  reason: z.string().min(1, "Red gerekçesi zorunludur."),
});

export type RejectFixedAssetInput = z.infer<typeof rejectFixedAssetSchema>;

export const depreciationScenarioSchema = z.object({
  scenarioId: z.string().min(1, "scenarioId zorunludur."),
});

export type DepreciationScenarioInput = z.infer<typeof depreciationScenarioSchema>;
