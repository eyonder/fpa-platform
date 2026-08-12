import { z } from "zod";

export const listExpenseEntriesSchema = z.object({
  scenarioId: z.string().min(1, "scenarioId zorunludur."),
  costCenterId: z.string().min(1).optional(),
  status: z
    .enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "COMMITTED"])
    .optional(),
});

export type ListExpenseEntriesQuery = z.infer<typeof listExpenseEntriesSchema>;

export const createExpenseEntrySchema = z.object({
  scenarioId: z.string().min(1, "scenarioId zorunludur."),
  costCenterId: z.string().min(1, "Gider merkezi zorunludur."),
  categoryId: z.string().min(1, "Gider türü zorunludur."),
  month: z.number().int().min(1).max(12),
  amount: z.number().positive("Tutar 0'dan büyük olmalı."),
});

export type CreateExpenseEntryInput = z.infer<typeof createExpenseEntrySchema>;

export const updateExpenseEntrySchema = z.object({
  amount: z.number().positive("Tutar 0'dan büyük olmalı."),
});

export type UpdateExpenseEntryInput = z.infer<typeof updateExpenseEntrySchema>;

export const rejectExpenseEntrySchema = z.object({
  reason: z.string().min(1, "Red gerekçesi zorunludur."),
});

export type RejectExpenseEntryInput = z.infer<typeof rejectExpenseEntrySchema>;

export const commitExpenseEntriesSchema = z.object({
  scenarioId: z.string().min(1, "scenarioId zorunludur."),
});

export type CommitExpenseEntriesInput = z.infer<typeof commitExpenseEntriesSchema>;

export const allocationReportQuerySchema = z.object({
  scenarioId: z.string().min(1, "scenarioId zorunludur."),
});

export type AllocationReportQuery = z.infer<typeof allocationReportQuerySchema>;
