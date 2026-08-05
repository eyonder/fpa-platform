/**
 * AG Grid Community'de native çoklu-hücre clipboard (Range Selection) yok —
 * bu Enterprise özelliği. Burada Excel/Sheets'ten kopyalanan TSV (tab
 * separated) bloğunu ayrıştırıp tabloya yazan, kendi yazdığımız hafif
 * kopyala/yapıştır yardımcıları var. bkz. BudgetGrid.tsx.
 */

import { parseAmount } from "@/shared/lib/parse-amount";

/** Tek sayı ayrıştırıcı frontend+backend arasında ortak — bkz. shared/lib/parse-amount.ts. */
export { parseAmount };

/** Panodan gelen TSV/CSV metnini satır × sütun sayı matrisine çevirir. */
export function parseClipboardGrid(text: string): number[][] {
  const lines = text.replace(/\r/g, "").split("\n");
  // Excel kopyalarken sona fazladan boş satır ekler; onu at.
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines.map((line) => line.split("\t").map(parseAmount));
}
