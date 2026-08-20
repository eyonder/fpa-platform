import { NotFoundError } from "@/backend/core/errors";
import type { RequestContext } from "@/backend/core/tenant";
import { budgetLineService } from "@/backend/modules/budget-lines/budget-line.service";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import { roundMoney } from "@/shared/lib/money";
import type {
  BudgetLine,
  BudgetLineInput,
  SalesActualsPreview,
  SalesPipelineForecastPreview,
} from "@/shared/types";

import { salesBillingMilestoneRepository } from "./sales-billing-milestone.repository";
import {
  loadSalesStageConfigMap,
  resolveWinProbability,
} from "./sales-opportunity.service";
import { salesOpportunityRepository } from "./sales-opportunity.repository";

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * `depreciation.service.ts` İLE AYNI disiplin: SENARYO BAZLI, HER SEFERİNDE
 * sıfırdan yeniden hesaplanan, TEKRAR ÇALIŞTIRILABİLİR iki BAĞIMSIZ eylem —
 * ara durum saklanmaz. Her ikisi de TEK bütçe yazma noktası olan
 * `budgetLineService.bulkUpsert`e (kaynak: SALES) yazar; kilit kontrolü ve
 * audit kaydı oradan otomatik gelir.
 *
 * ÖNEMLİ (bkz. prisma/schema.prisma'daki 13. bölüm notu): kod, actuals ve
 * pipeline forecast'in FARKLI senaryolara yazılmasını ZORUNLU KILMAZ —
 * `bulkUpsert` (scenarioId, categoryId, month) anahtarıyla ÜZERİNE YAZAR.
 * Aynı senaryoya işaret edilirse ikinci commit birincinin tutarlarını siler.
 * Bu uyarı frontend'de SalesActualsPostPanel/SalesPipelineForecastPostPanel'in
 * ipucu metninde de tekrarlanır.
 *
 * `previewActuals`: WON fırsatın TAM tutarı ARTIK tek başına `closedAt`
 * ayına DEĞİL, `SalesBillingMilestone` (hakediş faturalama) kayıtlarına göre
 * BİRDEN ÇOK aya bölünerek yazılır — bkz. sales-opportunity.service.ts'teki
 * close() notu: WON'a kapatmadan önce en az bir milestone ZORUNLUDUR ve
 * toplamları expectedValue'ya eşit olmalıdır, bu yüzden burada güvenle
 * "milestone yoksa katkısı yok" varsayılabilir (eski/test verisi hariç).
 */

// export edilir — ileride treasury modülü gibi başka modüller AYNI
// kategori id'sini tek kaynaktan kullanmak isteyebilir (bkz. DEPRECIATION_CATEGORY_ID).
export const SALES_CATEGORY_ID = "cat-gelir";

export const salesForecastService = {
  async previewActuals(
    context: RequestContext,
    scenarioId: string,
  ): Promise<SalesActualsPreview> {
    const scenario = await scenarioRepository.findById(context.tenantId, scenarioId);
    if (!scenario) throw new NotFoundError("Senaryo");

    const wonOpportunities = await salesOpportunityRepository.findWon(context.tenantId);

    const opportunities: SalesActualsPreview["opportunities"] = [];
    const totalsByMonth = new Map<number, number>();

    for (const opportunity of wonOpportunities) {
      const milestones = await salesBillingMilestoneRepository.findByOpportunity(
        context.tenantId,
        opportunity.id,
      );
      const milestonesThisYear = milestones.filter(
        (m) => new Date(m.billingDate).getUTCFullYear() === scenario.fiscalYear,
      );
      // Eski/eksik hakediş kaydı olan WON fırsat (bu özellikten ÖNCEKİ demo/
      // test verisi) — depreciation.service.ts'teki "bu yıla düşen kaydı
      // olmayan varlık atlanır" disipliniyle AYNI: hata FIRLATILMAZ, katkısı
      // olmaz.
      if (milestonesThisYear.length === 0) continue;

      for (const milestone of milestonesThisYear) {
        const month = new Date(milestone.billingDate).getUTCMonth() + 1;
        const amount = roundMoney(milestone.amount);

        opportunities.push({
          opportunityId: opportunity.id,
          customerName: opportunity.customerName,
          dealName: opportunity.dealName,
          billingDate: milestone.billingDate,
          month,
          amount,
        });

        totalsByMonth.set(month, roundMoney((totalsByMonth.get(month) ?? 0) + amount));
      }
    }

    const monthlyTotals = [...totalsByMonth.entries()]
      .sort(([a], [b]) => a - b)
      .map(([month, totalActual]) => ({ month, totalActual }));

    return {
      scenarioId,
      fiscalYear: scenario.fiscalYear,
      opportunities,
      monthlyTotals,
    };
  },

  async commitActuals(
    context: RequestContext,
    scenarioId: string,
  ): Promise<BudgetLine[]> {
    const preview = await this.previewActuals(context, scenarioId);

    if (preview.monthlyTotals.length === 0) return [];

    const lines: BudgetLineInput[] = preview.monthlyTotals.map((t) => ({
      categoryId: SALES_CATEGORY_ID,
      month: t.month,
      amount: t.totalActual,
    }));

    return budgetLineService.bulkUpsert(context, scenarioId, lines, "SALES");
  },

  async previewPipelineForecast(
    context: RequestContext,
    scenarioId: string,
  ): Promise<SalesPipelineForecastPreview> {
    const scenario = await scenarioRepository.findById(context.tenantId, scenarioId);
    if (!scenario) throw new NotFoundError("Senaryo");

    const stageConfigByStage = await loadSalesStageConfigMap();
    const openOpportunities = await salesOpportunityRepository.findOpen(
      context.tenantId,
    );

    const opportunities: SalesPipelineForecastPreview["opportunities"] = [];
    const totalsByMonth = new Map<number, number>();

    for (const opportunity of openOpportunities) {
      const expectedClose = new Date(opportunity.expectedCloseDate);
      if (expectedClose.getUTCFullYear() !== scenario.fiscalYear) continue;

      const month = expectedClose.getUTCMonth() + 1;
      const winProbability = resolveWinProbability(
        opportunity.stage,
        opportunity.winProbabilityOverride,
        stageConfigByStage,
      );
      const weightedAmount = roundMoney(opportunity.expectedValue * winProbability);

      opportunities.push({
        opportunityId: opportunity.id,
        customerName: opportunity.customerName,
        dealName: opportunity.dealName,
        stage: opportunity.stage,
        winProbability,
        month,
        weightedAmount,
      });

      totalsByMonth.set(
        month,
        roundMoney((totalsByMonth.get(month) ?? 0) + weightedAmount),
      );
    }

    const monthlyTotals = [...totalsByMonth.entries()]
      .sort(([a], [b]) => a - b)
      .map(([month, totalWeighted]) => ({ month, totalWeighted }));

    return {
      scenarioId,
      fiscalYear: scenario.fiscalYear,
      opportunities,
      monthlyTotals,
    };
  },

  async commitPipelineForecast(
    context: RequestContext,
    scenarioId: string,
  ): Promise<BudgetLine[]> {
    const preview = await this.previewPipelineForecast(context, scenarioId);

    if (preview.monthlyTotals.length === 0) return [];

    const lines: BudgetLineInput[] = preview.monthlyTotals.map((t) => ({
      categoryId: SALES_CATEGORY_ID,
      month: t.month,
      amount: t.totalWeighted,
    }));

    return budgetLineService.bulkUpsert(context, scenarioId, lines, "SALES");
  },
};
