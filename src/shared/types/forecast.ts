/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Geçmiş gerçekleşen verilerden basit büyüme oranıyla üretilen Forecast.
 */

export type GrowthMethod =
  | "AVERAGE_GROWTH"
  /** Büyüme oranı hesaplanamadı (yetersiz veri / sıfır tabanlı ay) -> son
   *  bilinen değer sabit taşındı. */
  | "FLAT";

export interface ForecastLine {
  /** 1-12 (Ocak-Aralık). */
  month: number;
  amount: number;
  source: "ACTUAL" | "PROJECTED";
}

export interface ForecastCategoryResult {
  categoryId: string;
  categoryName: string;
  method: GrowthMethod;
  /** Ay-ay ortalama büyüme oranı (%). Hesaplanamadıysa null. */
  growthRatePercent: number | null;
  /** asOfMonth'a kadar gerçekleşen + sonrası için projekte edilen tüm yıl. */
  lines: ForecastLine[];
}

export interface ForecastResult {
  actualScenarioId: string;
  forecastScenarioId: string;
  /** Gerçekleşenin bilindiği son ay; sonrası projekte edilir. */
  asOfMonth: number;
  /** true ise sonuç forecastScenarioId'ye yazıldı, false ise sadece önizleme. */
  persisted: boolean;
  categories: ForecastCategoryResult[];
}
