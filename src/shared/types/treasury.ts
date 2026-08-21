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

// ----------------------------------------------------
// Banka & Mutabakat (Faz 4.3)
// ----------------------------------------------------

/** "Top bakiye" — elle girilen banka bakiye fotoğrafı. Projeksiyonun
 * çıpasıdır (bkz. treasury-balance.service.ts). MVP: TEK hesap, TEK para
 * birimi (tenant.baseCurrency). */
export interface BankBalanceSnapshot {
  id: string;
  tenantId: string;
  /** YYYY-MM-DD */
  asOfDate: string;
  /** NEGATİF OLABİLİR (kredili mevduat). */
  balance: number;
  note: string | null;
  recordedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertBankBalanceInput {
  asOfDate: string;
  balance: number;
  note?: string;
}

/** Gerçekleşen banka hareketi. `CashFlowEvent`in (TAHMİN) karşısındaki
 * GERÇEK taraftır — mutabakat ikisini eşleştirir. */
export interface BankTransactionEntry {
  id: string;
  tenantId: string;
  /** YYYY-MM-DD (valör) */
  valueDate: string;
  direction: CashFlowDirection;
  /** HER ZAMAN pozitif; işareti direction taşır. */
  amount: number;
  description: string;
  counterparty: string | null;
  /** Banka referans no — mükerrer içe aktarımı engeller (tenant içinde tekil). */
  externalRef: string | null;

  matchedEventId: string | null;
  matchedAt: string | null;
  matchedByUserId: string | null;

  treasuryImportBatchId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankTransactionInput {
  valueDate: string;
  direction: CashFlowDirection;
  amount: number;
  description: string;
  counterparty?: string;
  externalRef?: string;
}

/** Ham puan (0-100) yerine UI'da BAND gösterilir — ham sayı sahte hassasiyet
 * hissi verir ve kullanıcıyı düşünmeden onaylamaya iter. */
export type MatchConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface MatchCandidate {
  eventId: string;
  score: number;
  confidence: MatchConfidence;
  /** işlem tutarı - tahmin tutarı (pozitif = banka daha yüksek). */
  amountDelta: number;
  /** valör - vade, GÜN cinsinden (pozitif = geç ödendi). */
  dayDelta: number;
  reasons: string[];
  /** Onay ekranında tahmini göstermek için özet — ayrı bir istek gerekmesin. */
  event: {
    dueDate: string;
    direction: CashFlowDirection;
    amount: number;
    categoryId: string;
    counterparty: string | null;
    description: string | null;
  };
}

export interface TransactionSuggestion {
  bankTransactionId: string;
  transaction: BankTransactionEntry;
  /** En iyi 3 aday. BOŞ ise "promote" (deftere ekle) önerilir. */
  candidates: MatchCandidate[];
}

export interface ReconciliationSuggestions {
  scenarioId: string;
  dateWindowDays: number;
  amountTolerancePct: number;
  suggestions: TransactionSuggestion[];
}

export interface ConfirmMatchPair {
  bankTransactionId: string;
  cashFlowEventId: string;
}

// ----------------------------------------------------
// Nakit pozisyonu (Faz 4.3 — §3.2 formülü)
// ----------------------------------------------------

export interface TreasuryPositionDay {
  /** YYYY-MM-DD */
  date: string;
  /** O güne ait GERÇEKLEŞEN banka hareketlerinin neti (işaretli). */
  bankActualNet: number;
  /** O güne ait PLANLANAN (henüz nötrlenmemiş) olayların neti (işaretli). */
  plannedNet: number;
  /** Gün sonu kümülatif bakiye. */
  closingBalance: number;
}

/** Vadesi geçmiş ama hâlâ eşleşmemiş tahminler. SESSİZCE DÜŞÜLMEZ —
 * düşülürse tahmin sinsice iyimserleşir (bkz. plan §3.2 kural 3). */
export interface UnreconciledOverdue {
  count: number;
  inflowTotal: number;
  outflowTotal: number;
}

export interface TreasuryPosition {
  scenarioId: string;
  startDate: string;
  endDate: string;
  /** Bakiyenin dayandığı top bakiye kaydı; YOKSA null ve opening 0 kabul edilir. */
  anchor: { asOfDate: string; balance: number } | null;
  openingBalance: number;
  days: TreasuryPositionDay[];
  unreconciledOverdue: UnreconciledOverdue;
  /** Bakiyenin İLK kez negatife düştüğü gün — yoksa null. */
  firstNegativeDate: string | null;
}

// ----------------------------------------------------
// Banka ekstresi içe aktarımı (Faz 4.3)
// ----------------------------------------------------

export type BankTargetField =
  | "valueDate"
  | "description"
  | "counterparty"
  | "amount"
  | "debit"
  | "credit"
  | "externalRef"
  | "skip";

export interface BankColumnMapping {
  sourceColumn: string;
  targetField: BankTargetField;
}

export type BankRowIssueCode =
  | "MISSING_COLUMNS"
  | "MISSING_VALUE_DATE"
  | "INVALID_AMOUNT"
  | "MISSING_DESCRIPTION"
  | "DUPLICATE_REF";

export interface BankRowIssue {
  rowNumber: number;
  code: BankRowIssueCode;
  message: string;
}

export interface BankPreviewRow {
  rowNumber: number;
  valueDate: string | null;
  /** HER ZAMAN pozitif (abs). */
  amount: number | null;
  /** Borç/Alacak kolonlarından ya da tek tutar kolonunun İŞARETİNDEN gelir. */
  direction: CashFlowDirection | null;
  description: string | null;
  counterparty: string | null;
  externalRef: string | null;
  /** DB'de aynı externalRef zaten varsa true — commit'te atlanır. */
  isDuplicate: boolean;
  raw: Record<string, string>;
}

export interface BankImportBatch {
  id: string;
  tenantId: string;
  scenarioId: string;
  fileName: string;
  status: TreasuryImportStatus;
  kind: TreasuryImportKind;
  detectedColumns: string[];
  suggestedMapping: BankColumnMapping[];
  appliedMapping: BankColumnMapping[];
  rows: BankPreviewRow[];
  issues: BankRowIssue[];
  rowCount: number;
  mappedCount: number;
  skippedCount: number;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}
