import { AppError, NotFoundError } from "@/backend/core/errors";
import { logger } from "@/backend/core/logger";
import type { RequestContext } from "@/backend/core/tenant";
import { budgetLineRepository } from "@/backend/modules/budget-lines/budget-line.repository";
import { budgetLineService } from "@/backend/modules/budget-lines/budget-line.service";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import {
  fromMinorUnits,
  roundMoney,
  roundPercent,
  toMinorUnits,
} from "@/shared/lib/money";
import type {
  BudgetLineInput,
  ForecastCategoryResult,
  ForecastResult,
  GrowthMethod,
} from "@/shared/types";

import type { GenerateForecastInput } from "./forecast.schema";

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * "Basit büyüme oranı" yöntemi: geçmiş ayların ardışık % değişimlerinin
 * ARİTMETİK ORTALAMASI alınır, kalan aylara BİLEŞİK (compounding) olarak
 * uygulanır. Bu, tek bir CAGR ya da lineer regresyon yerine bilinçli olarak
 * seçildi — istenen "basit" yöntemle örtüşüyor ve mevsimsel tek bir kötü ayın
 * projeksiyonu domine etmesini ortalama yumuşatıyor.
 */

interface GrowthProjection {
  method: GrowthMethod;
  growthRatePercent: number | null;
  /** Kalan aylar için projekte edilen tutarlar, sırasıyla. */
  projected: number[];
}

/** Dışa açık, saf hesaplama fonksiyonu — servis dışından da (test, başka rapor) çağrılabilir. */
export function projectByAverageGrowth(
  history: number[],
  periodsToProject: number,
): GrowthProjection {
  if (periodsToProject <= 0)
    return { method: "FLAT", growthRatePercent: null, projected: [] };

  const monthOverMonthRates: number[] = [];
  for (let i = 1; i < history.length; i++) {
    const previous = history[i - 1];
    // Sıfır tabanlı ay büyüme YÜZDESİ tanımsızdır (bölme hatası) -> atla.
    if (previous !== 0) monthOverMonthRates.push((history[i] - previous) / previous);
  }

  const lastKnown = history.length > 0 ? history[history.length - 1] : 0;

  if (monthOverMonthRates.length === 0) {
    // Büyüme oranı hesaplanamıyor (tek veri noktası ya da hep sıfır tabanlı) ->
    // son bilinen değeri sabit taşı. Bu, "veri yoksa tahmin uydurma" ilkesidir.
    const flat = roundMoney(lastKnown);
    return {
      method: "FLAT",
      growthRatePercent: null,
      projected: Array(periodsToProject).fill(flat),
    };
  }

  const averageRate =
    monthOverMonthRates.reduce((sum, rate) => sum + rate, 0) /
    monthOverMonthRates.length;

  // Bileşik büyütmeyi kuruş (integer minor unit) üzerinden yap: ondalık
  // sapması periyotlar arasında birikip raporu kaydırmasın (bkz. shared/lib/money.ts).
  let cursorMinorUnits = toMinorUnits(lastKnown);
  const projected: number[] = [];
  for (let i = 0; i < periodsToProject; i++) {
    cursorMinorUnits = Math.round(cursorMinorUnits * (1 + averageRate));
    projected.push(fromMinorUnits(cursorMinorUnits));
  }

  return {
    method: "AVERAGE_GROWTH",
    growthRatePercent: roundPercent(averageRate * 100),
    projected,
  };
}

export const forecastService = {
  async generate(
    context: RequestContext,
    input: GenerateForecastInput,
  ): Promise<ForecastResult> {
    const [actualScenario, forecastScenario] = await Promise.all([
      scenarioRepository.findById(context.tenantId, input.actualScenarioId),
      scenarioRepository.findById(context.tenantId, input.forecastScenarioId),
    ]);
    if (!actualScenario) throw new NotFoundError("Gerçekleşen senaryosu");
    if (!forecastScenario) throw new NotFoundError("Tahmin senaryosu");

    // Kilit kontrolü artık burada YAPILMIYOR — persist adımı aşağıda
    // budgetLineService.bulkUpsert'e devredildi, kilit kontrolü de audit
    // kaydı da (kaynak: FORECAST) TEK bir yerden, manuel düzenlemeyle
    // birebir aynı kuralla uygulanır (bkz. budget-line.service.ts).
    if (actualScenario.fiscalYear !== forecastScenario.fiscalYear) {
      throw new AppError(
        "FISCAL_YEAR_MISMATCH",
        "Gerçekleşen ve tahmin senaryoları aynı mali yıla ait olmalı.",
        422,
      );
    }

    const allCategories = await budgetLineRepository.findCategories(context.tenantId);
    const categories = input.categoryIds
      ? allCategories.filter((c) => input.categoryIds!.includes(c.id))
      : allCategories;

    const actualLines = await budgetLineRepository.findByScenario(
      input.actualScenarioId,
    );
    const linesByCategory = new Map<string, Map<number, number>>();
    for (const line of actualLines) {
      const monthMap =
        linesByCategory.get(line.categoryId) ?? new Map<number, number>();
      monthMap.set(line.month, line.amount);
      linesByCategory.set(line.categoryId, monthMap);
    }

    const remainingMonths = Array.from(
      { length: 12 - input.asOfMonth },
      (_, i) => input.asOfMonth + 1 + i,
    );

    const categoryResults: ForecastCategoryResult[] = [];
    const toPersist: BudgetLineInput[] = [];

    for (const category of categories) {
      const monthMap = linesByCategory.get(category.id) ?? new Map<number, number>();
      const history = Array.from(
        { length: input.asOfMonth },
        (_, i) => monthMap.get(i + 1) ?? 0,
      );

      const projection = projectByAverageGrowth(history, remainingMonths.length);

      const lines: ForecastCategoryResult["lines"] = [
        ...history.map((amount, i) => ({
          month: i + 1,
          amount: roundMoney(amount),
          source: "ACTUAL" as const,
        })),
        ...projection.projected.map((amount, i) => ({
          month: remainingMonths[i],
          amount,
          source: "PROJECTED" as const,
        })),
      ];

      categoryResults.push({
        categoryId: category.id,
        categoryName: category.name,
        method: projection.method,
        growthRatePercent: projection.growthRatePercent,
        lines,
      });

      for (const line of lines) {
        toPersist.push({
          categoryId: category.id,
          month: line.month,
          amount: line.amount,
        });
      }
    }

    if (input.persist) {
      // budgetLineService.bulkUpsert: kilit kontrolünü VE audit kaydını
      // (kaynak: FORECAST, eski/yeni değer + kullanıcı) kendisi yapar.
      await budgetLineService.bulkUpsert(
        context,
        input.forecastScenarioId,
        toPersist,
        "FORECAST",
      );
      logger.info("Forecast senaryoya yazıldı", {
        tenantId: context.tenantId,
        userId: context.userId,
        actualScenarioId: input.actualScenarioId,
        forecastScenarioId: input.forecastScenarioId,
        asOfMonth: input.asOfMonth,
        categoryCount: categoryResults.length,
      });
    }

    return {
      actualScenarioId: input.actualScenarioId,
      forecastScenarioId: input.forecastScenarioId,
      asOfMonth: input.asOfMonth,
      persisted: input.persist,
      categories: categoryResults,
    };
  },
};
