/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Gider Merkezleri modülü (Faz 2.2) — onay akışı: DRAFT/REJECTED'ten
 * SUBMITTED'e, oradan APPROVED/REJECTED'e, APPROVED'ten (commit ile)
 * COMMITTED'e. Sadece DRAFT/REJECTED durumundaki kayıtlar düzenlenebilir
 * (bkz. backend/modules/cost-centers/expense-entry.service.ts#assertEditable).
 */

export type ExpenseEntryStatus =
  "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "COMMITTED";

export interface ExpenseEntry {
  id: string;
  tenantId: string;
  scenarioId: string;
  costCenterId: string;
  categoryId: string;
  /** 1-12 (Ocak-Aralık). */
  month: number;
  amount: number;
  status: ExpenseEntryStatus;
  submittedByUserName: string | null;
  submittedAt: string | null;
  decidedByUserName: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  committedAt: string | null;
  updatedAt: string;
}

export interface CreateExpenseEntryInput {
  scenarioId: string;
  costCenterId: string;
  categoryId: string;
  month: number;
  amount: number;
}

export interface UpdateExpenseEntryInput {
  amount: number;
}

/** GET /api/expense-allocation-report yanıt satırı — bkz. expense-allocation.ts.
 * Raporlama amaçlıdır; BudgetLine'a yazılan toplamı ETKİLEMEZ. */
export interface AllocationReportRow {
  costCenterId: string;
  categoryId: string;
  month: number;
  amount: number;
}
