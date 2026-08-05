/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Bütçe-gerçekleşen sapma (varyans) analizi.
 */

export type VarianceStatus =
  | "FAVORABLE"
  | "UNFAVORABLE"
  | "ON_TARGET"
  /** Toplam satırı: gelir ve gider kategorileri karıştığı için tek yönlü
   *  olumlu/olumsuz yorumu yanıltıcı olur — kategori bazında incelenmeli. */
  | "MIXED";

export interface VarianceRow {
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  actualAmount: number;
  /** actualAmount - budgetAmount */
  varianceAmount: number;
  /** (varianceAmount / |budgetAmount|) * 100. Bütçe 0 ise hesaplanamaz -> null. */
  variancePercent: number | null;
  status: VarianceStatus;
}

export interface VarianceReport {
  budgetScenarioId: string;
  actualScenarioId: string;
  /** 1-12 (Ocak-Aralık), her ikisi dahil. */
  periodStart: number;
  periodEnd: number;
  currency: string;
  rows: VarianceRow[];
  total: VarianceRow;
}
