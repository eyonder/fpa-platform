/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Hazine (Treasury) modülü (Faz 4.1) — bkz. backend/modules/treasury/.
 *
 * BudgetLine'dan BAĞIMSIZ bir defterdir (gün hassasiyetli, NAKİT esaslı).
 * Faz 4.1 kapsamı SADECE model + minimal CRUD'dur — THP içe aktarım,
 * mutabakat ve projeksiyon/what-if sonraki fazlarda gelir.
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
