/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Bütçe giriş tablosunun (AG Grid) veri modeli: bir Scenario içinde,
 * kategori × ay eksenli tutarlar.
 */

/** Sapma analizinde "olumlu/olumsuz" yönünü belirler (bkz. variance.ts). */
export type BudgetCategoryType = "INCOME" | "EXPENSE";

export interface BudgetCategory {
  id: string;
  name: string;
  type: BudgetCategoryType;
  /** Grid'de satır sırası. */
  sortOrder: number;
}

export interface BudgetLine {
  scenarioId: string;
  categoryId: string;
  /** 1-12 (Ocak-Aralık). */
  month: number;
  amount: number;
  updatedAt: string;
}

/** Tek bir hücre için toplu kaydetme (bulk upsert) girdisi. */
export interface BudgetLineInput {
  categoryId: string;
  month: number;
  amount: number;
}

/** GET /api/budget-lines yanıtı: grid'i kurmak için gereken her şey. */
export interface BudgetSheet {
  scenarioId: string;
  categories: BudgetCategory[];
  lines: BudgetLine[];
}
