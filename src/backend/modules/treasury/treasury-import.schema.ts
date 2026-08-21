import { z } from "zod";

// `imports/import.schema.ts`teki AYNI sınırlar — iki sihirbaz da AYNI
// `parseFile` (ExcelJS/CSV) ayrıştırıcısını kullanır, bu yüzden dosya
// kısıtları da tek kaynaktan gelir.
export {
  ALLOWED_IMPORT_EXTENSIONS,
  MAX_IMPORT_FILE_BYTES,
} from "@/backend/modules/imports/import.schema";

const thpTargetFieldSchema = z.enum([
  "accountCode",
  "accountName",
  "balance",
  "dueDate",
  "documentDate",
  "skip",
]);

export const thpColumnMappingSchema = z.object({
  sourceColumn: z.string().min(1),
  targetField: thpTargetFieldSchema,
});

export const remapTreasuryImportSchema = z.object({
  mapping: z.array(thpColumnMappingSchema).min(1),
});

export type RemapTreasuryImportInput = z.infer<typeof remapTreasuryImportSchema>;
