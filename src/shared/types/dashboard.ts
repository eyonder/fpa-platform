import type { BudgetCategoryType } from "./budget-line";
import type { GrowthMethod } from "./forecast";

/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Yönetici özet panosu (Genel Bakış): yıl içi Bütçe / Gerçekleşen / Tahmin
 * eğrisi ve dört başlık metriği (KPI).
 */

export interface DashboardMonthPoint {
  /** 1-12 (Ocak-Aralık). */
  month: number;
  budget: number;
  /** Sadece month <= asOfMonth için dolu; sonrası null. */
  actual: number | null;
  /** Sadece month >= asOfMonth için dolu (asOfMonth'ta gerçekleşenle AYNI
   *  değeri taşır — çizgi grafikte dolu-kesikli geçişin kesintisiz görünmesi
   *  için); öncesi null. */
  forecast: number | null;
}

export interface DashboardKpis {
  /** 12 ayın bütçe toplamı. */
  annualBudget: number;
  /** 1..asOfMonth bütçe toplamı (YTD sapma kıyaslaması için). */
  ytdBudget: number;
  /** 1..asOfMonth gerçekleşen toplamı. */
  ytdActual: number;
  /** asOfMonth+1..12 için projekte edilen toplam. */
  remainingForecast: number;
  /** ytdActual + remainingForecast — yıl sonu projeksiyonu. */
  fullYearProjection: number;
  /** (fullYearProjection - annualBudget) / |annualBudget| * 100. Bütçe 0 ise null. */
  variancePercent: number | null;
  /** Kalan aylar için kullanılan büyüme oranı (%). Hesaplanamadıysa null. */
  growthRatePercent: number | null;
  growthMethod: GrowthMethod;
}

export interface DashboardSummary {
  budgetScenarioId: string;
  actualScenarioId: string;
  fiscalYear: number;
  asOfMonth: number;
  categoryType: BudgetCategoryType;
  currency: string;
  months: DashboardMonthPoint[];
  kpis: DashboardKpis;
}
