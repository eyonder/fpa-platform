import { budgetGridTheme } from "@/frontend/components/budget-grid/budget-grid.theme";

/**
 * Hazine ızgaralarının teması. `budget-grid.theme.ts`i UZATIR (kendi
 * `themeQuartz.withParams` çağrısını KURMAZ) — defter/kağıt görünümünün tek
 * kaynağı orasıdır; kopyalanan renk paletleri tam olarak böyle ayrışır.
 *
 * Tek fark satır yüksekliği: nakit defteri satır başına bir yükümlülük
 * gösterir ve bütçe ızgarasından çok daha uzun listelenir, sıkı satır aralığı
 * ekranda daha çok gün görünmesini sağlar.
 */
export const treasuryGridTheme = budgetGridTheme.withParams({
  rowVerticalPaddingScale: 0.85,
});
