import { MONTH_FIELDS, MONTHS, type MonthField } from "@/shared/constants/months";
import type { BudgetCategory, BudgetLine, BudgetLineInput } from "@/shared/types";

/** Grid'in satır şekli: her kategori bir satır, her ay ayrı bir alan. */
export type GridRow = {
  categoryId: string;
  categoryName: string;
  total: number;
} & Record<MonthField, number>;

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Uzun formattaki (kategori × ay) satırları grid'in geniş matrisine çevirir. */
export function pivotToRows(
  categories: BudgetCategory[],
  lines: BudgetLine[],
): GridRow[] {
  const byCategory = new Map<string, BudgetLine[]>();
  for (const line of lines) {
    const list = byCategory.get(line.categoryId) ?? [];
    list.push(line);
    byCategory.set(line.categoryId, list);
  }

  return categories.map((category) => {
    const row = {
      categoryId: category.id,
      categoryName: category.name,
      total: 0,
    } as GridRow;
    const categoryLines = byCategory.get(category.id) ?? [];

    for (const field of MONTH_FIELDS) row[field] = 0;
    for (const line of categoryLines) {
      const field = MONTHS.find((m) => m.month === line.month)?.field;
      if (field) row[field] = line.amount;
    }

    row.total = round2(MONTH_FIELDS.reduce((sum, field) => sum + row[field], 0));
    return row;
  });
}

/** Bir satırın 12 aylık değerlerini backend'in bulk-upsert formatına çevirir. */
export function toLineInputs(row: GridRow): BudgetLineInput[] {
  return MONTHS.map((m) => ({
    categoryId: row.categoryId,
    month: m.month,
    amount: row[m.field],
  }));
}

/**
 * "Yıllık Toplam" hücresine yeni bir değer girildiğinde (yukarıdan aşağıya
 * bütçeleme), bu toplamı 12 aya dağıtır:
 *  - Satırda zaten bir dağılım varsa (toplam ≠ 0), mevcut oranı korur
 *    (örn. mevsimsellik bozulmaz, sadece ölçeklenir).
 *  - Satır boşsa (hepsi 0), 12 aya eşit dağıtır.
 * Yuvarlama farkı (kuruş kayması) son aya (Aralık) yazılır ki toplam TAM
 * girilen değere eşit kalsın.
 */
export function redistributeTotal(row: GridRow, newTotal: number): number[] {
  const currentTotal = MONTH_FIELDS.reduce((sum, field) => sum + row[field], 0);

  const distributed =
    currentTotal === 0
      ? MONTH_FIELDS.map(() => round2(newTotal / 12))
      : MONTH_FIELDS.map((field) => round2((row[field] / currentTotal) * newTotal));

  const drift = round2(newTotal - distributed.reduce((sum, v) => sum + v, 0));
  distributed[distributed.length - 1] = round2(
    distributed[distributed.length - 1] + drift,
  );

  return distributed;
}
