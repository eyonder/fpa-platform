import { AppError, NotFoundError } from "@/backend/core/errors";
import { resolveDisplayConversion } from "@/backend/modules/fx/display-currency";
import { budgetLineRepository } from "@/backend/modules/budget-lines/budget-line.repository";
import { projectByAverageGrowth } from "@/backend/modules/forecast/forecast.service";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import { roundMoney, roundPercent } from "@/shared/lib/money";
import type { BudgetLine, DashboardMonthPoint, DashboardSummary } from "@/shared/types";

import type { DashboardSummaryQuery } from "./dashboard.schema";

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * Yönetici panosu: Bütçe (tam yıl), Gerçekleşen (1..asOfMonth) ve Tahmin
 * (asOfMonth+1..12) tek bir eğri olarak birleştirilir. Tahmin, forecast
 * modülündeki AYNI saf `projectByAverageGrowth` fonksiyonuyla üretilir —
 * mantık iki yerde ayrı ayrı yazılıp birbirinden sapmasın diye.
 */

function sumByMonth(lines: BudgetLine[], categoryIds: Set<string>): number[] {
  const totals = Array(12).fill(0) as number[];
  for (const line of lines) {
    if (!categoryIds.has(line.categoryId)) continue;
    totals[line.month - 1] = roundMoney(totals[line.month - 1] + line.amount);
  }
  return totals;
}

/**
 * asOfMonth verilmediyse: takvim tarihine göre DEĞİL, gerçekleşen senaryosunda
 * verinin GERÇEKTEN dolu olduğu son aya göre türetilir. Neden: bir ay
 * kapanmadan önce o ayın satırları genelde 0 olarak seed edilir/oluşturulur
 * (henüz girilmedi anlamında) — "bugün"ün takvim ayını kullanmak, henüz veri
 * girilmemiş ayları "gerçekleşen 0 harcama" gibi göstererek sahte, dramatik
 * bir sapma üretir. Geçmiş/gelecek mali yıllar için hâlâ takvime bakılır.
 */
function defaultAsOfMonth(fiscalYear: number, actualByMonth: number[]): number {
  const now = new Date();
  if (fiscalYear < now.getFullYear()) return 12;
  if (fiscalYear > now.getFullYear()) return 0;

  for (let month = 12; month >= 1; month--) {
    if (actualByMonth[month - 1] !== 0) return month;
  }
  return 0;
}

export const dashboardService = {
  async getSummary(
    tenantId: string,
    query: DashboardSummaryQuery,
  ): Promise<DashboardSummary> {
    const [budgetScenario, actualScenario] = await Promise.all([
      scenarioRepository.findById(tenantId, query.budgetScenarioId),
      scenarioRepository.findById(tenantId, query.actualScenarioId),
    ]);
    if (!budgetScenario) throw new NotFoundError("Bütçe senaryosu");
    if (!actualScenario) throw new NotFoundError("Gerçekleşen senaryosu");

    if (
      budgetScenario.fiscalYear !== query.fiscalYear ||
      actualScenario.fiscalYear !== query.fiscalYear
    ) {
      throw new AppError(
        "FISCAL_YEAR_MISMATCH",
        "Bütçe ve gerçekleşen senaryoları, istenen mali yılla eşleşmeli.",
        422,
      );
    }
    // Farklı para birimleri: `displayCurrency` verilmişse ortak birime
    // çevrilir (bkz. variance.service.ts'teki aynı gerekçe).
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

    const fxAsOfDate = `${budgetScenario.fiscalYear}-12-31`;
    const [budgetFx, actualFx] = await Promise.all([
      resolveDisplayConversion(
        budgetScenario.baseCurrency,
        query.displayCurrency,
        fxAsOfDate,
      ),
      resolveDisplayConversion(
        actualScenario.baseCurrency,
        query.displayCurrency,
        fxAsOfDate,
      ),
    ]);

    const [allCategories, budgetLines, actualLines] = await Promise.all([
      budgetLineRepository.findCategories(tenantId),
      budgetLineRepository.findByScenario(query.budgetScenarioId),
      budgetLineRepository.findByScenario(query.actualScenarioId),
    ]);

    const categoryIds = new Set(
      allCategories.filter((c) => c.type === query.categoryType).map((c) => c.id),
    );

    // Her taraf KENDİ kaynak biriminden ortak görüntüleme birimine çevrilir.
    const budgetByMonth = sumByMonth(
      budgetFx.rate === 1
        ? budgetLines
        : budgetLines.map((l) => ({ ...l, amount: budgetFx.convert(l.amount) })),
      categoryIds,
    );
    const actualByMonth = sumByMonth(
      actualFx.rate === 1
        ? actualLines
        : actualLines.map((l) => ({ ...l, amount: actualFx.convert(l.amount) })),
      categoryIds,
    );

    const asOfMonth =
      query.asOfMonth ?? defaultAsOfMonth(query.fiscalYear, actualByMonth);

    const history = actualByMonth.slice(0, asOfMonth);
    const remainingCount = 12 - asOfMonth;
    const projection = projectByAverageGrowth(history, remainingCount);

    const months: DashboardMonthPoint[] = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const isPast = month <= asOfMonth;
      const isBoundary = month === asOfMonth;

      return {
        month,
        budget: budgetByMonth[i],
        actual: isPast ? actualByMonth[i] : null,
        // Dolu-kesikli geçişin grafikte kesintisiz görünmesi için: sınır
        // ayında (asOfMonth) forecast de actual'la AYNI değeri taşır.
        forecast: isBoundary
          ? actualByMonth[i]
          : isPast
            ? null
            : projection.projected[month - asOfMonth - 1],
      };
    });

    const annualBudget = roundMoney(budgetByMonth.reduce((s, v) => s + v, 0));
    const ytdBudget = roundMoney(
      budgetByMonth.slice(0, asOfMonth).reduce((s, v) => s + v, 0),
    );
    const ytdActual = roundMoney(history.reduce((s, v) => s + v, 0));
    const remainingForecast = roundMoney(
      projection.projected.reduce((s, v) => s + v, 0),
    );
    const fullYearProjection = roundMoney(ytdActual + remainingForecast);
    const variancePercent =
      annualBudget !== 0
        ? roundPercent(
            ((fullYearProjection - annualBudget) / Math.abs(annualBudget)) * 100,
          )
        : null;

    return {
      budgetScenarioId: query.budgetScenarioId,
      actualScenarioId: query.actualScenarioId,
      fiscalYear: query.fiscalYear,
      asOfMonth,
      categoryType: query.categoryType,
      currency: query.displayCurrency ?? budgetScenario.baseCurrency,
      months,
      kpis: {
        annualBudget,
        ytdBudget,
        ytdActual,
        remainingForecast,
        fullYearProjection,
        variancePercent,
        growthRatePercent: projection.growthRatePercent,
        growthMethod: projection.method,
      },
    };
  },
};
