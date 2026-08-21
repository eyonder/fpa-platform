/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Hazine (Treasury) modülü (Faz 4.1-4.2) — bkz. backend/modules/treasury/.
 *
 * BudgetLine'dan BAĞIMSIZ bir defterdir (gün hassasiyetli, NAKİT esaslı).
 * Faz 4.1: model + minimal CRUD. Faz 4.2: THP (Tek Düzen Hesap Planı)
 * eşleştirme kuralları + Excel içe aktarım sihirbazı. Mutabakat ve
 * projeksiyon/what-if sonraki fazlarda gelir.
 */

export type CashFlowDirection = "INFLOW" | "OUTFLOW";

export type CashFlowEventStatus = "PLANNED" | "NEUTRALIZED" | "CANCELLED";

export type CashFlowEventSource = "MANUAL" | "THP_IMPORT";

export interface CashFlowEvent {
  id: string;
  tenantId: string;
  scenarioId: string;

  /** YYYY-MM-DD — paranın bankaya girdiği/çıktığı gün. */
  dueDate: string;
  direction: CashFlowDirection;
  /** HER ZAMAN pozitif; işareti direction taşır. */
  amount: number;

  status: CashFlowEventStatus;
  source: CashFlowEventSource;

  /** Tahakkuk katmanına yumuşak referans — FK YOK, işaret edilen BudgetLine
   * satırı hiç var olmayabilir (bkz. backend/modules/treasury dosya başı notu). */
  accrualScenarioId: string | null;
  /** 1-12 */
  accrualStartMonth: number | null;
  accrualSpreadMonths: number;

  categoryId: string;
  counterparty: string | null;
  description: string | null;

  thpAccountCode: string | null;
  mappingConfigId: string | null;
  treasuryImportBatchId: string | null;

  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCashFlowEventInput {
  scenarioId: string;
  dueDate: string;
  direction: CashFlowDirection;
  amount: number;
  categoryId: string;
  counterparty?: string;
  description?: string;
  accrualScenarioId?: string;
  accrualStartMonth?: number;
  accrualSpreadMonths?: number;
}

export type UpdateCashFlowEventInput = Partial<
  Omit<CreateCashFlowEventInput, "scenarioId">
>;

// ----------------------------------------------------
// THP (Tek Düzen Hesap Planı) eşleştirme kuralları (Faz 4.2)
// ----------------------------------------------------

/** 120/320 gibi BİLANÇO hesapları (gerçek vade taşır) vs. 600/770 gibi
 * GELİR TABLOSU hesapları (tahakkuk — nakit olayı ÜRETMEZ). */
export type MappingLayer = "CASH" | "ACCRUAL";

export interface MappingConfigEntry {
  id: string;
  tenantId: string;
  /** "120", "320.01" gibi — ÖNEK olarak eşleşir (en uzun önek kazanır). */
  accountCode: string;
  accountName: string;
  categoryId: string;
  direction: CashFlowDirection;
  layer: MappingLayer;
  /** Vade tarihi çözümlenemezse: belge tarihi + bu gün sayısı. */
  defaultTermDays: number | null;
  isActive: boolean;
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMappingConfigInput {
  accountCode: string;
  accountName: string;
  categoryId: string;
  direction: CashFlowDirection;
  layer?: MappingLayer;
  defaultTermDays?: number;
  isActive?: boolean;
  note?: string;
}

export type UpdateMappingConfigInput = Partial<CreateMappingConfigInput>;

// ----------------------------------------------------
// THP Excel içe aktarım sihirbazı (Faz 4.2)
// ----------------------------------------------------

export type TreasuryImportStatus = "PENDING_REVIEW" | "COMMITTED" | "DISCARDED";

export type TreasuryImportKind = "THP" | "BANK_STATEMENT";

export type ThpTargetField =
  "accountCode" | "accountName" | "balance" | "dueDate" | "documentDate" | "skip";

export interface ThpColumnMapping {
  sourceColumn: string;
  targetField: ThpTargetField;
}

export type ThpRowIssueCode =
  | "MISSING_ACCOUNT_CODE"
  | "INVALID_AMOUNT"
  | "UNMAPPED"
  | "ACCRUAL_LAYER_SKIPPED"
  | "MISSING_DUE_DATE";

export interface ThpRowIssue {
  rowNumber: number;
  code: ThpRowIssueCode;
  message: string;
}

export interface ThpPreviewRow {
  rowNumber: number;
  accountCode: string | null;
  accountName: string | null;
  /** HER ZAMAN pozitif (abs alınır) — işaret mappingConfig.direction'dan gelir. */
  amount: number | null;
  /** YYYY-MM-DD, çözümlenemediyse null. */
  dueDate: string | null;
  direction: CashFlowDirection | null;
  categoryId: string | null;
  categoryName: string | null;
  mappingConfigId: string | null;
  layer: MappingLayer | null;
  /** Dosyadaki HAM hücreler, kolon adına göre — önizleme tablosunda ham veriyi göstermek için. */
  raw: Record<string, string>;
}

export interface TreasuryImportBatch {
  id: string;
  tenantId: string;
  scenarioId: string;
  fileName: string;
  status: TreasuryImportStatus;
  kind: TreasuryImportKind;
  detectedColumns: string[];
  suggestedMapping: ThpColumnMapping[];
  appliedMapping: ThpColumnMapping[];
  rows: ThpPreviewRow[];
  issues: ThpRowIssue[];
  rowCount: number;
  mappedCount: number;
  skippedCount: number;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}
