/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Nakit Akış raporu — basit dolaylı yöntem (bkz. backend/modules/cash-flow/cash-flow.service.ts).
 * Tahsilat/ödeme vadesi MODELLENMEZ; sadece amortisman (geri ekleme) ve
 * sabit kıymet alım tutarı (düşme) ile tahakkuktan (bütçe) nakde geçilir.
 */

export interface CashFlowMonthRow {
  /** 1-12 */
  month: number;
  /** Tahakkuk esaslı: Σ Gelir - Σ Gider (o ay). */
  netBudget: number;
  /** Amortisman Giderleri'nin o ayki tutarı — nakit çıkışı değildir, geri eklenir. */
  depreciationAddBack: number;
  /** O ay alınan onaylı sabit kıymetlerin toplam bedeli — P&L'de yok, gerçek nakit çıkışı. */
  capexOutflow: number;
  /** netBudget + depreciationAddBack - capexOutflow */
  netCashFlow: number;
}

export interface CashFlowReport {
  scenarioId: string;
  fiscalYear: number;
  currency: string;
  periodStart: number;
  periodEnd: number;
  months: CashFlowMonthRow[];
  totals: Omit<CashFlowMonthRow, "month">;
}
