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

// `.strict()` KASITLI: Zod varsayılan olarak BİLİNMEYEN anahtarları SESSİZCE
// ATAR. Bu uçta bu davranış tehlikeliydi — istemci yanlış alan adı gönderdiğinde
// (ör. grid'in `date`i, API'nin `dueDate`i yerine) istek 200 dönüyor ama HİÇBİR
// ŞEY değişmiyordu. Bir nakit defterinde "başarıyla hiçbir şey yapmadım" en kötü
// hata türüdür; artık 422 VALIDATION_FAILED olur (canlı doğrulamada yakalandı).
export const updateCashFlowEventSchema = createCashFlowEventSchema
  .omit({ scenarioId: true })
  .partial()
  .strict();

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

// ----------------------------------------------------
// Banka & Mutabakat (Faz 4.3)
// ----------------------------------------------------

// `balance` NEGATİF OLABİLİR (kredili mevduat) — `amount` alanlarındaki
// `.positive()` disiplini BURAYA UYGULANMAZ, bilinçli.
// ISO-4217: 3 harf, büyük. Serbest metin kabul etmek "TL"/"tl"/"TRY" gibi
// varyantların AYRI hesaplar doğurmasına yol açardı.
const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Para birimi 3 harfli ISO kodu olmalı (TRY, USD, EUR).");

export const createBankAccountSchema = z.object({
  bankName: z.string().min(1, "Banka adı zorunludur.").max(120),
  currency: currencySchema,
  iban: z.string().max(40).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;

export const upsertBankBalanceSchema = z.object({
  bankAccountId: z.string().min(1, "Banka hesabı seçilmeli."),
  asOfDate: dateSchema,
  balance: z.number(),
  note: z.string().optional(),
});

export type UpsertBankBalanceInput = z.infer<typeof upsertBankBalanceSchema>;

export const createBankTransactionSchema = z.object({
  bankAccountId: z.string().min(1, "Banka hesabı seçilmeli."),
  valueDate: dateSchema,
  direction: cashFlowDirectionSchema,
  amount: z.number().positive("Tutar 0'dan büyük olmalı."),
  description: z.string().min(1, "Açıklama zorunludur."),
  counterparty: z.string().optional(),
  externalRef: z.string().optional(),
});

export type CreateBankTransactionInput = z.infer<typeof createBankTransactionSchema>;

export const listBankTransactionsSchema = z.object({
  fromDate: dateSchema.optional(),
  toDate: dateSchema.optional(),
  /** "true" -> sadece eşleşmemiş hareketler (mutabakat ekranının varsayılanı). */
  onlyUnmatched: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  bankAccountId: z.string().min(1).optional(),
});

export type ListBankTransactionsQuery = z.infer<typeof listBankTransactionsSchema>;

// Tolerans/pencere ÜST SINIRLARI kasıtlı: 30 günü ve %5'i aşan bir "eşleşme"
// artık eşleşme değil tahmindir — kullanıcı isterse elle promote eder.
export const reconciliationSuggestionsSchema = z.object({
  scenarioId: z.string().min(1, "scenarioId zorunludur."),
  fromDate: dateSchema.optional(),
  toDate: dateSchema.optional(),
  dateWindowDays: z.number().int().min(0).max(30).optional(),
  amountTolerancePct: z.number().min(0).max(5).optional(),
});

export type ReconciliationSuggestionsQuery = z.infer<
  typeof reconciliationSuggestionsSchema
>;

export const confirmMatchesSchema = z.object({
  pairs: z
    .array(
      z.object({
        bankTransactionId: z.string().min(1),
        cashFlowEventId: z.string().min(1),
      }),
    )
    .min(1, "En az bir eşleşme seçilmeli.")
    .max(200, "Tek seferde en fazla 200 eşleşme onaylanabilir."),
});

export type ConfirmMatchesInput = z.infer<typeof confirmMatchesSchema>;

export const unmatchSchema = z.object({
  bankTransactionId: z.string().min(1, "bankTransactionId zorunludur."),
});

export type UnmatchInput = z.infer<typeof unmatchSchema>;

export const promoteTransactionSchema = z.object({
  bankTransactionId: z.string().min(1, "bankTransactionId zorunludur."),
  scenarioId: z.string().min(1, "scenarioId zorunludur."),
  categoryId: z.string().min(1, "categoryId zorunludur."),
  description: z.string().optional(),
});

export type PromoteTransactionInput = z.infer<typeof promoteTransactionSchema>;

// 90 gün varsayılan (plan §3.2 "90 günlük yuvarlanan nakit pozisyonu");
// 366 üst sınırı bir yıllık pencereye izin verir ama sınırsız tarama YOK.
export const treasuryPositionSchema = z.object({
  scenarioId: z.string().min(1, "scenarioId zorunludur."),
  startDate: dateSchema.optional(),
  days: z.coerce.number().int().min(1).max(366).optional(),
  displayCurrency: z
    .string()
    .regex(/^[A-Z]{3}$/, "Para birimi 3 harfli ISO kodu olmalı.")
    .optional(),
});

export type TreasuryPositionQuery = z.infer<typeof treasuryPositionSchema>;

export const bankTargetFieldSchema = z.enum([
  "valueDate",
  "description",
  "counterparty",
  "amount",
  "debit",
  "credit",
  "externalRef",
  "skip",
]);

export const bankRemapSchema = z.object({
  mapping: z.array(
    z.object({
      sourceColumn: z.string(),
      targetField: bankTargetFieldSchema,
    }),
  ),
});

export type BankRemapInput = z.infer<typeof bankRemapSchema>;

// Vade üst sınırı 365: bir yıldan uzun bir ödeme vadesi bütçe verisinden
// türetilecek makul bir varsayım değildir, veri girişi hatasıdır.
export const generateFromBudgetSchema = z.object({
  scenarioId: z.string().min(1, "scenarioId zorunludur."),
  sourceScenarioId: z.string().min(1).optional(),
  revenueTermDays: z.number().int().min(0).max(365).optional(),
  expenseTermDays: z.number().int().min(0).max(365).optional(),
});

export type GenerateFromBudgetInput = z.infer<typeof generateFromBudgetSchema>;
