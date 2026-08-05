/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Buraya sadece saf tip ve sabit girer; React veya veritabanı kodu asla girmez.
 */

export type ScenarioKind = "BUDGET" | "ACTUAL" | "FORECAST";

export interface Scenario {
  id: string;
  tenantId: string;
  name: string;
  kind: ScenarioKind;
  fiscalYear: number;
  /** Onaylanan bütçe kilitlenir, artık veri girişi kabul etmez. */
  isLocked: boolean;
  baseCurrency: string;
  updatedAt: string;
}
