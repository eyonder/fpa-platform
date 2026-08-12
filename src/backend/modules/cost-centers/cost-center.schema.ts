import { z } from "zod";

const codeSchema = z
  .string()
  .min(1, "Kod zorunludur.")
  .max(20, "Kod en fazla 20 karakter olabilir.")
  .regex(/^[A-Za-z0-9_-]+$/, "Kod sadece harf, rakam, tire ve alt çizgi içerebilir.");

export const createCostCenterSchema = z.object({
  code: codeSchema,
  name: z.string().min(1, "Ad zorunludur."),
  parentCostCenterId: z.string().min(1).optional(),
});

export type CreateCostCenterInput = z.infer<typeof createCostCenterSchema>;

export const updateCostCenterSchema = z.object({
  code: codeSchema.optional(),
  name: z.string().min(1).optional(),
  parentCostCenterId: z.string().min(1).nullable().optional(),
});

export type UpdateCostCenterInput = z.infer<typeof updateCostCenterSchema>;

const allocationKeyMemberSchema = z.object({
  costCenterId: z.string().min(1),
  weightPercent: z.number().finite().min(0).max(100),
});

export const upsertAllocationKeySchema = z
  .object({
    name: z.string().min(1, "Ad zorunludur."),
    members: z
      .array(allocationKeyMemberSchema)
      .min(1, "En az bir üye gider merkezi gereklidir."),
  })
  .refine(
    (input) => {
      const total = input.members.reduce((sum, m) => sum + m.weightPercent, 0);
      return Math.abs(total - 100) <= 0.01;
    },
    {
      message: "Üye ağırlıkları toplamda %100 etmeli.",
      path: ["members"],
    },
  );

export type UpsertAllocationKeyInput = z.infer<typeof upsertAllocationKeySchema>;
