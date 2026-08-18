import { NotFoundError } from "@/backend/core/errors";
import { budgetLineRepository } from "@/backend/modules/budget-lines/budget-line.repository";
import { DEPRECIATION_CATEGORY_ID } from "@/backend/modules/fixed-assets/depreciation.service";
import { fixedAssetRepository } from "@/backend/modules/fixed-assets/fixed-asset.repository";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import { roundMoney } from "@/shared/lib/money";
import type { CashFlowMonthRow, CashFlowReport } from "@/shared/types";

import type { CashFlowQuery } from "./cash-flow.schema";

/**
 * İŞ MANTIĞI KATMANI (Service) — saf hesaplama, `variance.service.ts` ile
 * AYNI disiplin (DB'siz, tek yönlü okuma, yazma YOK).
 *
 * Basit dolaylı yöntem (indirect method): tahsilat/ödeme vadesi (AR/AP
 * zamanlaması) MODELLENMEZ — diğer tüm kalemlerin aynı ay içinde nakde
 * dönüştüğü varsayılır. Sadece bilinen iki sapma noktası düzeltilir:
 *   1. Amortisman Giderleri (cat-amortisman) P&L'de gider görünür ama nakit
 *      ÇIKIŞI DEĞİLDİR -> geri eklenir.
 *   2. Sabit kıymet alım tutarı (FixedAsset.baseValue) GERÇEK bir nakit
 *      çıkışıdır ama hiçbir BudgetLine'da YER ALMAZ (bkz.
 *      depreciation.service.ts'teki tasarım notu) -> alım ayında düşülür.
 *
 * Net Nakit Akışı = Net Bütçe (Gelir - Gider) + Amortisman - Sabit Kıymet Alımı
 */

function monthOfDate(isoDate: string): number {
  return Number(isoDate.slice(5, 7));
}

function yearOfDate(isoDate: string): number {
  return Number(isoDate.slice(0, 4));
}

export const cashFlowService = {
  async compute(tenantId: string, query: CashFlowQuery): Promise<CashFlowReport> {
    const scenario = await scenarioRepository.findById(tenantId, query.scenarioId);
    if (!scenario) throw new NotFoundError("Senaryo");

    const [categories, lines, approvedAssets] = await Promise.all([
      budgetLineRepository.findCategories(),
      budgetLineRepository.findByScenario(query.scenarioId),
      fixedAssetRepository.findApproved(tenantId),
    ]);
    const categoryTypeById = new Map(categories.map((c) => [c.id, c.type]));

    const netBudgetByMonth = new Map<number, number>();
    const depreciationByMonth = new Map<number, number>();

    for (const line of lines) {
      if (line.month < query.periodStart || line.month > query.periodEnd) continue;

      const type = categoryTypeById.get(line.categoryId);
      const signedAmount = type === "INCOME" ? line.amount : -line.amount;
      netBudgetByMonth.set(
        line.month,
        roundMoney((netBudgetByMonth.get(line.month) ?? 0) + signedAmount),
      );

      if (line.categoryId === DEPRECIATION_CATEGORY_ID) {
        depreciationByMonth.set(
          line.month,
          roundMoney((depreciationByMonth.get(line.month) ?? 0) + line.amount),
        );
      }
    }

    const capexByMonth = new Map<number, number>();
    for (const asset of approvedAssets) {
      const month = monthOfDate(asset.acquisitionDate);
      const year = yearOfDate(asset.acquisitionDate);
      if (year !== scenario.fiscalYear) continue;
      if (month < query.periodStart || month > query.periodEnd) continue;

      capexByMonth.set(
        month,
        roundMoney((capexByMonth.get(month) ?? 0) + asset.baseValue),
      );
    }

    const months: CashFlowMonthRow[] = [];
    for (let month = query.periodStart; month <= query.periodEnd; month++) {
      const netBudget = netBudgetByMonth.get(month) ?? 0;
      const depreciationAddBack = depreciationByMonth.get(month) ?? 0;
      const capexOutflow = capexByMonth.get(month) ?? 0;
      months.push({
        month,
        netBudget,
        depreciationAddBack,
        capexOutflow,
        netCashFlow: roundMoney(netBudget + depreciationAddBack - capexOutflow),
      });
    }

    const totals = months.reduce(
      (acc, m) => ({
        netBudget: roundMoney(acc.netBudget + m.netBudget),
        depreciationAddBack: roundMoney(
          acc.depreciationAddBack + m.depreciationAddBack,
        ),
        capexOutflow: roundMoney(acc.capexOutflow + m.capexOutflow),
        netCashFlow: roundMoney(acc.netCashFlow + m.netCashFlow),
      }),
      { netBudget: 0, depreciationAddBack: 0, capexOutflow: 0, netCashFlow: 0 },
    );

    return {
      scenarioId: query.scenarioId,
      fiscalYear: scenario.fiscalYear,
      currency: scenario.baseCurrency,
      periodStart: query.periodStart,
      periodEnd: query.periodEnd,
      months,
      totals,
    };
  },
};
