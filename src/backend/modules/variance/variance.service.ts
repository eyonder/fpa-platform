import { AppError, NotFoundError } from "@/backend/core/errors";
import { resolveDisplayConversion } from "@/backend/modules/fx/display-currency";
import { budgetLineRepository } from "@/backend/modules/budget-lines/budget-line.repository";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import { roundMoney, roundPercent } from "@/shared/lib/money";
import type {
  BudgetCategoryType,
  BudgetLine,
  VarianceReport,
  VarianceRow,
} from "@/shared/types";

import type { CompareVarianceQuery } from "./variance.schema";

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * Bütçe-gerçekleşen sapma (varyans) hesabı:
 *   varianceAmount  = actualAmount - budgetAmount
 *   variancePercent = varianceAmount / |budgetAmount| * 100   (bütçe 0 ise null)
 *
 * "Olumlu/olumsuz" yönü kategori tipine göre TERSTİR:
 *   - Gider kategorisinde actual < budget olumludur (az harcandı).
 *   - Gelir kategorisinde actual > budget olumludur (çok kazanıldı).
 * Bu yüzden tek bir "pozitif = iyi" kuralı YANLIŞ olurdu — bkz. calculateVarianceRow.
 */

/** Dışa açık, saf hesaplama fonksiyonu — servis dışından da (test, başka rapor) çağrılabilir. */
export function calculateVarianceRow(
  categoryId: string,
  categoryName: string,
  categoryType: BudgetCategoryType,
  budgetAmountRaw: number,
  actualAmountRaw: number,
): VarianceRow {
  const budgetAmount = roundMoney(budgetAmountRaw);
  const actualAmount = roundMoney(actualAmountRaw);
  const varianceAmount = roundMoney(actualAmount - budgetAmount);
  const variancePercent =
    budgetAmount !== 0
      ? roundPercent((varianceAmount / Math.abs(budgetAmount)) * 100)
      : null;

  const status: VarianceRow["status"] =
    varianceAmount === 0
      ? "ON_TARGET"
      : categoryType === "INCOME"
        ? varianceAmount > 0
          ? "FAVORABLE"
          : "UNFAVORABLE"
        : varianceAmount < 0
          ? "FAVORABLE"
          : "UNFAVORABLE";

  return {
    categoryId,
    categoryName,
    budgetAmount,
    actualAmount,
    varianceAmount,
    variancePercent,
    status,
  };
}

function buildTotalRow(rows: VarianceRow[]): VarianceRow {
  const budgetAmount = roundMoney(rows.reduce((sum, r) => sum + r.budgetAmount, 0));
  const actualAmount = roundMoney(rows.reduce((sum, r) => sum + r.actualAmount, 0));
  const varianceAmount = roundMoney(actualAmount - budgetAmount);
  const variancePercent =
    budgetAmount !== 0
      ? roundPercent((varianceAmount / Math.abs(budgetAmount)) * 100)
      : null;

  return {
    categoryId: "__total__",
    categoryName: "TOPLAM",
    budgetAmount,
    actualAmount,
    varianceAmount,
    // Toplamda gelir ve gider karıştığı için tek yönlü olumlu/olumsuz etiketi
    // yanıltıcı olur (bkz. dosya başındaki not) -> MIXED, sadece tam eşleşme ON_TARGET.
    variancePercent,
    status: varianceAmount === 0 ? "ON_TARGET" : "MIXED",
  };
}

function sumAmountsByCategory(
  lines: BudgetLine[],
  periodStart: number,
  periodEnd: number,
) {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (line.month < periodStart || line.month > periodEnd) continue;
    totals.set(
      line.categoryId,
      roundMoney((totals.get(line.categoryId) ?? 0) + line.amount),
    );
  }
  return totals;
}

export const varianceService = {
  async compare(
    tenantId: string,
    query: CompareVarianceQuery,
  ): Promise<VarianceReport> {
    const [budgetScenario, actualScenario] = await Promise.all([
      scenarioRepository.findById(tenantId, query.budgetScenarioId),
      scenarioRepository.findById(tenantId, query.actualScenarioId),
    ]);
    if (!budgetScenario) throw new NotFoundError("Bütçe senaryosu");
    if (!actualScenario) throw new NotFoundError("Gerçekleşen senaryosu");

    // UFRS/raporlama tutarlılığı: farklı mali yılları veya farklı para
    // birimlerini (kur çevrimi yapmadan) doğrudan karşılaştırmak yanıltıcı
    // sonuç üretir -> erken ve net biçimde reddet.
    if (budgetScenario.fiscalYear !== actualScenario.fiscalYear) {
      throw new AppError(
        "FISCAL_YEAR_MISMATCH",
        "Bütçe ve gerçekleşen senaryoları aynı mali yıla ait olmalı.",
        422,
      );
    }
    // İKİ SENARYO FARKLI PARA BİRİMİNDEYSE: `displayCurrency` verilmişse her
    // iki taraf da ORTAK bir birime çevrilir ve karşılaştırma anlamlı olur
    // (gerçek müşteri verisinde plan USD, gerçekleşen TRY). Verilmemişse eski
    // davranış korunur — sessizce iki farklı birimi karşılaştırmaktansa
    // açıkça reddetmek doğrudur.
    if (
      !query.displayCurrency &&
      budgetScenario.baseCurrency !== actualScenario.baseCurrency
    ) {
      throw new AppError(
        "CURRENCY_MISMATCH",
        "Bütçe ve gerçekleşen senaryoları farklı para biriminde. Üst çubuktan bir " +
          "görüntüleme para birimi seçin (TRY/USD/EUR) ya da senaryoları aynı " +
          "birime getirin.",
        422,
      );
    }

    const asOfDate = `${budgetScenario.fiscalYear}-12-31`;
    const [budgetFx, actualFx] = await Promise.all([
      resolveDisplayConversion(
        budgetScenario.baseCurrency,
        query.displayCurrency,
        asOfDate,
      ),
      resolveDisplayConversion(
        actualScenario.baseCurrency,
        query.displayCurrency,
        asOfDate,
      ),
    ]);

    const [categories, budgetLines, actualLines] = await Promise.all([
      budgetLineRepository.findCategories(tenantId),
      budgetLineRepository.findByScenario(query.budgetScenarioId),
      budgetLineRepository.findByScenario(query.actualScenarioId),
    ]);

    // Her taraf KENDİ kaynağından çevrilir (plan USD, gerçekleşen TRY olabilir).
    const budgetTotals = sumAmountsByCategory(
      budgetFx.rate === 1
        ? budgetLines
        : budgetLines.map((l) => ({ ...l, amount: budgetFx.convert(l.amount) })),
      query.periodStart,
      query.periodEnd,
    );
    const actualTotals = sumAmountsByCategory(
      actualFx.rate === 1
        ? actualLines
        : actualLines.map((l) => ({ ...l, amount: actualFx.convert(l.amount) })),
      query.periodStart,
      query.periodEnd,
    );

    const rows = categories.map((category) =>
      calculateVarianceRow(
        category.id,
        category.name,
        category.type,
        budgetTotals.get(category.id) ?? 0,
        actualTotals.get(category.id) ?? 0,
      ),
    );

    return {
      budgetScenarioId: query.budgetScenarioId,
      actualScenarioId: query.actualScenarioId,
      periodStart: query.periodStart,
      periodEnd: query.periodEnd,
      currency: query.displayCurrency ?? budgetScenario.baseCurrency,
      rows,
      total: buildTotalRow(rows),
    };
  },
};
