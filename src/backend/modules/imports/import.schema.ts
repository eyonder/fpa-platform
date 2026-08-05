import { z } from "zod";

const importTargetFieldSchema = z.enum(["categoryId", "month", "amount", "skip"]);

export const importColumnMappingSchema = z.object({
  sourceColumn: z.string().min(1),
  targetField: importTargetFieldSchema,
});

export const remapImportSchema = z.object({
  mapping: z.array(importColumnMappingSchema).min(1),
});

export type RemapImportInput = z.infer<typeof remapImportSchema>;

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMPORT_EXTENSIONS = [".csv", ".xlsx", ".xls"];
