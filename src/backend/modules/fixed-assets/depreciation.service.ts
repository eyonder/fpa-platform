import { NotFoundError } from "@/backend/core/errors";
import type { RequestContext } from "@/backend/core/tenant";
import { budgetLineService } from "@/backend/modules/budget-lines/budget-line.service";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import { fromMinorUnits, roundMoney, toMinorUnits } from "@/shared/lib/money";
import type { BudgetLine, BudgetLineInput, DepreciationPreview } from "@/shared/types";

import { generateDepreciationSchedule } from "./depreciation-schedule";
import { fixedAssetRepository } from "./fixed-asset.repository";
import { loadVukConfigMap, resolveDepreciationParams } from "./fixed-asset.service";

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * `FixedAsset`'te COMMITTED durumu YOK (bkz. prisma/schema.prisma'daki 12.
 * bölüm notu) — bir varlığın amortismanı BİRDEN ÇOK mali yıla (Scenario'ya)
 * yayılır. Bu yüzden bütçeye yazma, `payroll.service.ts`teki preview/
 * commitToBudget'ın AYNI disiplini: SENARYO BAZLI, HER SEFERİNDE sıfırdan
 * yeniden hesaplanan, TEKRAR ÇALIŞTIRILABİLİR bir eylem — ara durum
 * saklanmaz. `commitForScenario`, `previewForScenario`'yu TEKRAR hesaplayıp
 * TEK bütçe yazma noktası olan `budgetLineService.bulkUpsert`e (kaynak:
 * DEPRECIATION) yazar; kilit kontrolü ve audit kaydı oradan otomatik gelir.
 */

// export edilir — commitForScenario dahil, bu kategoriye yazan/okuyan HER
// çağıran AYNI kategori id'sini tek kaynaktan kullanır.
export const DEPRECIATION_CATEGORY_ID = "cat-amortisman";

export const depreciationService = {
  async previewForScenario(
    context: RequestContext,
    scenarioId: string,
  ): Promise<DepreciationPreview> {
    const scenario = await scenarioRepository.findById(context.tenantId, scenarioId);
    if (!scenario) throw new NotFoundError("Senaryo");

    const vukConfigByCategory = await loadVukConfigMap();
    const approvedAssets = await fixedAssetRepository.findApproved(context.tenantId);

    const assets: DepreciationPreview["assets"] = [];
    const totalsByMonth = new Map<number, number>();

    for (const asset of approvedAssets) {
      const { annualRate, usefulLifeYears } = resolveDepreciationParams(
        asset.category,
        asset.usefulLifeYearsOverride,
        vukConfigByCategory,
      );
      const acquisition = new Date(asset.acquisitionDate);
      const entries = generateDepreciationSchedule({
        baseValueMinor: toMinorUnits(asset.baseValue),
        annualRate,
        usefulLifeYears,
        acquisitionYear: acquisition.getUTCFullYear(),
        acquisitionMonth: acquisition.getUTCMonth() + 1,
      });

      const entriesThisYear = entries.filter((e) => e.year === scenario.fiscalYear);
      if (entriesThisYear.length === 0) continue;

      assets.push({
        fixedAssetId: asset.id,
        assetName: asset.assetName,
        monthlyAmounts: entriesThisYear.map((e) => ({
          month: e.month,
          amount: fromMinorUnits(e.amountMinor),
        })),
      });

      for (const entry of entriesThisYear) {
        totalsByMonth.set(
          entry.month,
          roundMoney(
            (totalsByMonth.get(entry.month) ?? 0) + fromMinorUnits(entry.amountMinor),
          ),
        );
      }
    }

    const monthlyTotals = [...totalsByMonth.entries()]
      .sort(([a], [b]) => a - b)
      .map(([month, totalDepreciation]) => ({ month, totalDepreciation }));

    return { scenarioId, fiscalYear: scenario.fiscalYear, assets, monthlyTotals };
  },

  async commitForScenario(
    context: RequestContext,
    scenarioId: string,
  ): Promise<BudgetLine[]> {
    const preview = await this.previewForScenario(context, scenarioId);

    if (preview.monthlyTotals.length === 0) return [];

    const lines: BudgetLineInput[] = preview.monthlyTotals.map((t) => ({
      categoryId: DEPRECIATION_CATEGORY_ID,
      month: t.month,
      amount: t.totalDepreciation,
    }));

    return budgetLineService.bulkUpsert(context, scenarioId, lines, "DEPRECIATION");
  },
};
