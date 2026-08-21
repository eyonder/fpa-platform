/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Bütçe giriş tablosunun (AG Grid) veri modeli: bir Scenario içinde,
 * kategori × ay eksenli tutarlar.
 */

/** Sapma analizinde "olumlu/olumsuz" yönünü belirler (bkz. variance.ts). */
export type BudgetCategoryType = "INCOME" | "EXPENSE";

export interface BudgetCategory {
  id: string;
  /** Tenant İÇİNDE kararlı anahtar ("cat-gelir", "600.010" gibi).
   * `id` artık tenant'a özeldir; konsolidasyon ve modüllerin sabit kategori
   * referansları BU alan üzerinden çalışır (bkz. prisma/schema.prisma). */
  code: string;
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
  /** Senaryonun KENDİ para birimi — düzenlemeler bu birimde yazılır. */
  sourceCurrency: string;
  /** Ekranda gösterilen birim; çevrim yapılmadıysa sourceCurrency ile aynı. */
  displayCurrency: string;
  /** 1 = çevrim yok. Düzenleme yapılırken tutarı geri çevirmek için gerekir. */
  fxRate: number;
  /** Kur bulunamadıysa GÖRÜNÜR uyarı (bkz. fx/display-currency.ts). */
  warnings: string[];
}
