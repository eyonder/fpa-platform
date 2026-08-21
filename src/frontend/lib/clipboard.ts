/**
 * AG Grid Community'de native çoklu-hücre clipboard (Range Selection) yok —
 * bu Enterprise özelliği. Burada Excel/Sheets'ten kopyalanan TSV (tab
 * separated) bloğunu ayrıştıran, kendi yazdığımız hafif yardımcılar var.
 * bkz. BudgetGrid.tsx (sayısal ızgara) ve TreasuryScreen.tsx (nakit defteri).
 */

import { parseAmount } from "@/shared/lib/parse-amount";

/** Tek sayı ayrıştırıcı frontend+backend arasında ortak — bkz. shared/lib/parse-amount.ts. */
export { parseAmount };

/**
 * Panodan gelen TSV/CSV metnini HAM METİN matrisine çevirir.
 *
 * Genel biçim budur; `parseClipboardGrid` bunun sayısal bir haritasıdır.
 * Nakit defteri yapıştırması tarih ve serbest metin de taşıdığı için
 * sayıya ÇEVİRMEDEN ham hücrelere ihtiyaç duyar (Faz 4.4).
 */
export function parseClipboardTable(text: string): string[][] {
  const lines = text.replace(/\r/g, "").split("\n");
  // Excel kopyalarken sona fazladan boş satır ekler; onu at.
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines.map((line) => line.split("\t").map((cell) => cell.trim()));
}

/** Panodan gelen TSV/CSV metnini satır × sütun SAYI matrisine çevirir. */
export function parseClipboardGrid(text: string): number[][] {
  return parseClipboardTable(text).map((row) => row.map(parseAmount));
}
