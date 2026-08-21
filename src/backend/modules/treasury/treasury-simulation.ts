import { roundMoney } from "@/shared/lib/money";
import type {
  BudgetCategory,
  ProjectionRow,
  RowFilter,
  TreasuryAdjustment,
} from "@/shared/types";

import { addDays } from "./treasury.dates";

/**
 * SAF WHAT-IF MOTORU — HTTP/Prisma/React bilmez, veritabanı olmadan test
 * edilebilir. Satır listesi girer, satır listesi çıkar.
 *
 * UYGULAMA SIRASI SABİTTİR VE BİR DOĞRULUK MESELESİDİR, detay değil:
 *   1. SCALE_BY_FILTER              — önce tutarlar oturur
 *   2. SHIFT_EVENT, SHIFT_BY_FILTER — sonra tarihler kayar
 *   3. ADD_EVENT, SPOT_LOAN         — en son yeni satırlar enjekte edilir
 * Aynı aşama içinde dizi sırası geçerlidir.
 *
 * 3. aşamada enjekte edilen satırlar 1. ve 2. aşamanın filtrelerine TABİ
 * DEĞİLDİR — "tüm tedarikçi ödemelerini 30 gün ötele" komutu, az önce
 * eklenen spot kredi geri ödemesini de yanlışlıkla ötelememelidir.
 *
 * `PAYROLL_RAISE` BURADA İŞLENMEZ: bordroyu 1.30 ile çarpmak YANLIŞ olurdu
 * (artan oranlı gelir vergisi + kümülatif matrah dilim aşımı doğrusal
 * değildir), bu yüzden gerçek bordro motoru yeniden çalıştırılır — bkz.
 * treasury-projection.service.ts ve payroll.service.ts#previewAggregate.
 */

const SIMULATION_CATEGORY_FALLBACK = "cat-diger";

/** Yıllık faizden vade sonu geri ödeme tutarı (basit faiz, gün/365). */
export function computeRepaymentAmount(
  principal: number,
  termDays: number,
  annualRatePct: number | undefined,
  explicitRepayment: number | undefined,
): number {
  if (explicitRepayment !== undefined) return roundMoney(explicitRepayment);
  if (annualRatePct === undefined) return roundMoney(principal);
  return roundMoney(principal * (1 + (annualRatePct / 100) * (termDays / 365)));
}

function matches(row: ProjectionRow, filter: RowFilter): boolean {
  if (filter.direction && row.direction !== filter.direction) return false;
  if (filter.categoryIds?.length && !filter.categoryIds.includes(row.categoryId)) {
    return false;
  }
  if (filter.sources?.length && !filter.sources.includes(row.source)) return false;
  if (filter.counterpartyContains) {
    const haystack =
      `${row.counterparty ?? ""} ${row.description ?? ""}`.toLocaleLowerCase("tr-TR");
    if (!haystack.includes(filter.counterpartyContains.toLocaleLowerCase("tr-TR"))) {
      return false;
    }
  }
  if (filter.dateFrom && row.date < filter.dateFrom) return false;
  if (filter.dateTo && row.date > filter.dateTo) return false;
  return true;
}

function categoryName(categories: BudgetCategory[], id: string): string {
  return categories.find((c) => c.id === id)?.name ?? id;
}

export function applyAdjustments(
  rows: ProjectionRow[],
  adjustments: TreasuryAdjustment[],
  categories: BudgetCategory[],
): ProjectionRow[] {
  // --- 1. AŞAMA: ölçekleme (factor 0 = satırı kaldır) ---
  let current = rows.map((row) => ({ ...row }));

  for (const adjustment of adjustments) {
    if (adjustment.kind !== "SCALE_BY_FILTER") continue;
    current = current
      .map((row) => {
        if (!matches(row, adjustment.filter)) return row;
        return {
          ...row,
          amount: roundMoney(row.amount * adjustment.factor),
          adjustmentId: adjustment.id,
        };
      })
      .filter((row) => row.amount > 0);
  }

  // --- 2. AŞAMA: tarih kaydırma ---
  for (const adjustment of adjustments) {
    if (adjustment.kind === "SHIFT_EVENT") {
      current = current.map((row) =>
        row.rowId === adjustment.targetRowId
          ? {
              ...row,
              date: addDays(row.date, adjustment.shiftDays),
              adjustmentId: adjustment.id,
            }
          : row,
      );
    } else if (adjustment.kind === "SHIFT_BY_FILTER") {
      current = current.map((row) =>
        matches(row, adjustment.filter)
          ? {
              ...row,
              date: addDays(row.date, adjustment.shiftDays),
              adjustmentId: adjustment.id,
            }
          : row,
      );
    }
  }

  // --- 3. AŞAMA: enjeksiyon (yukarıdaki filtrelere TABİ DEĞİL) ---
  const injected: ProjectionRow[] = [];

  for (const adjustment of adjustments) {
    if (adjustment.kind === "ADD_EVENT") {
      const categoryId = adjustment.categoryId ?? SIMULATION_CATEGORY_FALLBACK;
      injected.push({
        rowId: `sim:${adjustment.id}`,
        eventId: null,
        date: adjustment.date,
        direction: adjustment.direction,
        amount: roundMoney(adjustment.amount),
        categoryId,
        categoryName: categoryName(categories, categoryId),
        counterparty: null,
        description: adjustment.label,
        source: "SIMULATION",
        status: null,
        editable: false,
        accrualStartMonth: null,
        adjustmentId: adjustment.id,
      });
    } else if (adjustment.kind === "SPOT_LOAN") {
      // Spot kredi sunucu tarafında İKİ ADD_EVENT'e açılır: vade başında
      // anapara girişi, vade sonunda geri ödeme çıkışı.
      const repayment = computeRepaymentAmount(
        adjustment.principal,
        adjustment.termDays,
        adjustment.annualRatePct,
        adjustment.repaymentAmount,
      );
      const base = {
        eventId: null,
        categoryId: SIMULATION_CATEGORY_FALLBACK,
        categoryName: categoryName(categories, SIMULATION_CATEGORY_FALLBACK),
        counterparty: null,
        source: "SIMULATION" as const,
        status: null,
        editable: false,
        accrualStartMonth: null,
        adjustmentId: adjustment.id,
      };
      injected.push({
        ...base,
        rowId: `sim:${adjustment.id}:draw`,
        date: adjustment.drawDate,
        direction: "INFLOW",
        amount: roundMoney(adjustment.principal),
        description: `${adjustment.label} — anapara`,
      });
      injected.push({
        ...base,
        rowId: `sim:${adjustment.id}:repay`,
        date: addDays(adjustment.drawDate, adjustment.termDays),
        direction: "OUTFLOW",
        amount: repayment,
        description: `${adjustment.label} — geri ödeme`,
      });
    }
  }

  // --- 4. AŞAMA: tarihe göre yeniden sırala ---
  return [...current, ...injected].sort(
    (a, b) => a.date.localeCompare(b.date) || a.rowId.localeCompare(b.rowId),
  );
}

/** `PAYROLL_RAISE` düzeltmesini bordro motoruna geçirilecek çarpana çevirir.
 * Mali yıl DIŞINDA kalan bir yürürlük tarihi, yılın başına/sonuna kırpılır. */
export function resolvePayrollRaise(
  adjustments: TreasuryAdjustment[],
  fiscalYear: number,
): { grossMultiplier: number; effectiveFromMonth: number } | null {
  const raise = adjustments.find((a) => a.kind === "PAYROLL_RAISE");
  if (!raise || raise.kind !== "PAYROLL_RAISE") return null;

  const year = Number(raise.effectiveFrom.slice(0, 4));
  const month = Number(raise.effectiveFrom.slice(5, 7));
  const effectiveFromMonth = year < fiscalYear ? 1 : year > fiscalYear ? 13 : month;

  return {
    grossMultiplier: 1 + raise.percent / 100,
    effectiveFromMonth,
  };
}
