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

/** BUDGET_DERIVED: bütçe/gerçekleşen satırlarından üretilmiş (bkz.
 * budget-to-cash.service.ts). Yeniden üretim SADECE bunları siler. */
export type CashFlowEventSource = "MANUAL" | "THP_IMPORT" | "BUDGET_DERIVED";

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

/** Banka hesabı. BİR HESAP = BİR PARA BİRİMİ (aynı bankanın TL/USD/EUR
 * bakiyeleri AYRI hesaplardır — kaynak bakiye tablosu da böyle kuruludur). */
export interface BankAccount {
  id: string;
  tenantId: string;
  bankName: string;
  /** Hesabın para birimi; tutarlar HEP bu birimdedir. */
  currency: string;
  iban: string | null;
  isActive: boolean;
  sortOrder: number;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankAccountInput {
  bankName: string;
  currency: string;
  iban?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export type UpdateBankAccountInput = Partial<CreateBankAccountInput>;

/** "Top bakiye" — elle girilen banka bakiye fotoğrafı. Projeksiyonun
 * çıpasıdır (bkz. treasury-balance.service.ts). MVP: TEK hesap, TEK para
 * birimi (tenant.baseCurrency). */
export interface BankBalanceSnapshot {
  id: string;
  tenantId: string;
  bankAccountId: string;
  /** Gösterim kolaylığı için hesaptan kopyalanır (salt okunur). */
  bankName: string;
  currency: string;
  /** YYYY-MM-DD */
  asOfDate: string;
  /** HESABIN KENDİ para biriminde. NEGATİF OLABİLİR (kredili mevduat). */
  balance: number;
  note: string | null;
  recordedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertBankBalanceInput {
  bankAccountId: string;
  asOfDate: string;
  balance: number;
  note?: string;
}

/** Gerçekleşen banka hareketi. `CashFlowEvent`in (TAHMİN) karşısındaki
 * GERÇEK taraftır — mutabakat ikisini eşleştirir. */
export interface BankTransactionEntry {
  id: string;
  tenantId: string;
  bankAccountId: string;
  bankName: string;
  currency: string;
  /** YYYY-MM-DD (valör) */
  valueDate: string;
  direction: CashFlowDirection;
  /** HESABIN KENDİ para biriminde. HER ZAMAN pozitif; işareti direction taşır. */
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
  bankAccountId: string;
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
  /** Gösterilen para birimi (çevrim yapılmadıysa senaryonunki). */
  currency: string;
  /** Bakiyenin dayandığı top bakiye; YOKSA null ve opening 0 kabul edilir.
   * Çoklu hesapta: en güncel fotoğrafın tarihi + hesap kırılımı (her biri
   * kendi para biriminde, ayrıca raporlama birimine çevrilmiş hali). */
  anchor: {
    asOfDate: string;
    balance: number;
    accounts: Array<{
      bankAccountId: string;
      bankName: string;
      currency: string;
      balance: number;
      convertedBalance: number;
      fxRate: number;
    }>;
  } | null;
  openingBalance: number;
  days: TreasuryPositionDay[];
  unreconciledOverdue: UnreconciledOverdue;
  /** Bakiyenin İLK kez negatife düştüğü gün — yoksa null. */
  firstNegativeDate: string | null;
  /** Eksik kur vb. — ASLA sessizce yanlış bakiye gösterilmez (bkz. treasury-fx.ts). */
  warnings: string[];
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

// ----------------------------------------------------
// Projeksiyon & What-If simülasyonu (Faz 4.4)
// ----------------------------------------------------

/** Projeksiyon satırının KAYNAĞI. DB enum'u `CashFlowEventSource`tan
 * BİLEREK GENİŞTİR (sadece TypeScript'te yaşar): türetilmiş (Satış/Capex/
 * Bordro) ve simüle edilmiş satırların karşılığı olan bir DB satırı YOKTUR. */
export type ProjectionSource =
  | "MANUAL"
  | "THP_IMPORT"
  | "BUDGET_DERIVED"
  | "SALES"
  | "PIPELINE"
  | "CAPEX"
  | "PAYROLL"
  | "SIMULATION";

export type ProjectionGranularity = "DAY" | "WEEK";

export interface ProjectionRow {
  /** Kararlı kimlik — AG Grid `getRowId` ve `SHIFT_EVENT` hedeflemesi için.
   * "event:<id>" | "sales:<milestoneId>" | "capex:<assetId>" |
   * "payroll:<yyyy-mm>:net|statutory" | "sim:<adjustmentId>[:leg]" */
  rowId: string;
  /** Düzenlenebilir satırlarda PATCH hedefi; türetilmiş/simüle satırlarda null.
   * (rowId'yi string olarak ayrıştırmak yerine AÇIK alan — frontend'in
   * kimlik şemasını bilmesi gerekmesin.) */
  eventId: string | null;
  /** YYYY-MM-DD */
  date: string;
  direction: CashFlowDirection;
  /** HER ZAMAN pozitif; işareti direction taşır. */
  amount: number;
  categoryId: string;
  categoryName: string;
  counterparty: string | null;
  description: string | null;
  source: ProjectionSource;
  /** Sadece kalıcı `CashFlowEvent` satırlarında dolu. */
  status: CashFlowEventStatus | null;
  editable: boolean;
  /** Tahakkuk katmanına yumuşak referans (salt okunur gösterim). */
  accrualStartMonth: number | null;
  /** Bu satırı üreten/etkileyen what-if düzeltmesi. */
  adjustmentId?: string;
}

export interface ProjectionBucket {
  /** DAY'de gün, WEEK'te ISO haftasının PAZARTESİsi. */
  date: string;
  inflow: number;
  outflow: number;
  net: number;
  closingBalance: number;
}

export interface ProjectionSummary {
  baselineMinBalance: number;
  baselineMinDate: string | null;
  baselineClosing: number;
  baselineFirstNegativeDate: string | null;
  simulatedMinBalance: number | null;
  simulatedMinDate: string | null;
  simulatedClosing: number | null;
  simulatedFirstNegativeDate: string | null;
  deltaClosing: number | null;
  deltaMinBalance: number | null;
}

export interface IncludeDerivedSources {
  sales?: boolean;
  capex?: boolean;
  payroll?: boolean;
  /** Açık pipeline (kazanılmamış fırsatlar × kazanma olasılığı) —
   * VARSAYILAN KAPALI: %40 olasılıklı bir fırsat, ödeme gücü tablosunda
   * bankadaki para gibi görünmemelidir. */
  pipeline?: boolean;
}

export interface TreasuryProjection {
  scenarioId: string;
  startDate: string;
  endDate: string;
  granularity: ProjectionGranularity;
  currency: string;
  openingBalance: number;
  /** Açılışın dayandığı top bakiye tarihi; hiç kayıt yoksa null. */
  openingBalanceAsOf: string | null;
  /** DÜZ, tarihe göre sıralı liste — defter grid'ini besler. */
  rows: ProjectionRow[];
  baseline: ProjectionBucket[];
  /** `adjustments` boşken null. */
  simulated: ProjectionBucket[] | null;
  summary: ProjectionSummary;
  unreconciledOverdue: UnreconciledOverdue;
  /** Çift sayım şüphesi vb. — ASLA otomatik satır düşürülmez, sadece uyarılır. */
  warnings: string[];
}

// --- What-If düzeltmeleri (tek etiketli birleşim, tek uç) ---

export interface RowFilter {
  direction?: CashFlowDirection;
  categoryIds?: string[];
  sources?: ProjectionSource[];
  counterpartyContains?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type TreasuryAdjustment =
  | {
      kind: "ADD_EVENT";
      id: string;
      label: string;
      direction: CashFlowDirection;
      amount: number;
      date: string;
      categoryId?: string;
    }
  | {
      kind: "SPOT_LOAN";
      id: string;
      label: string;
      principal: number;
      drawDate: string;
      termDays: number;
      repaymentAmount?: number;
      annualRatePct?: number;
    }
  | { kind: "SHIFT_EVENT"; id: string; targetRowId: string; shiftDays: number }
  | { kind: "SHIFT_BY_FILTER"; id: string; filter: RowFilter; shiftDays: number }
  /** factor 0 = satırı kaldır — ayrı bir REMOVE varyantı YOK. */
  | { kind: "SCALE_BY_FILTER"; id: string; filter: RowFilter; factor: number }
  | { kind: "PAYROLL_RAISE"; id: string; percent: number; effectiveFrom: string };

export interface TreasurySimulationInput {
  scenarioId: string;
  startDate?: string;
  horizonDays?: number;
  granularity?: ProjectionGranularity;
  includeDerived?: IncludeDerivedSources;
  adjustments: TreasuryAdjustment[];
}
