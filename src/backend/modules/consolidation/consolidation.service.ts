import { ForbiddenError, NotFoundError } from "@/backend/core/errors";
import { budgetLineRepository } from "@/backend/modules/budget-lines/budget-line.repository";
import { fxRateService } from "@/backend/modules/fx/fx-rate.service";
import { organizationRepository } from "@/backend/modules/organizations/organization.repository";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import { roundMoney } from "@/shared/lib/money";
import type {
  ConsolidationMissingOrg,
  ConsolidationReport,
  ConsolidationRow,
} from "@/shared/types";

import type { ConsolidateQuery } from "./consolidation.schema";

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * Konsolidasyon algoritması:
 *   1. Ana şirketin (parent) tüm alt ağacını (children + torunlar) topla.
 *   2. Ana şirket dahil her katılımcı için, istenen mali yıl/tür için AKTİF
 *      senaryosunu bul (yoksa "eksik" listesine ekle, işlemi DURDURMA —
 *      gerçek dünyada bir alt şirket bütçesini henüz girmemiş olabilir).
 *   3. Senaryonun kategori bazında dönem toplamını KENDİ para biriminde çıkar.
 *   4. fxRateService ile ana şirketin para birimine çevir (kur, satır bazında
 *      saklanır — IFRS 21 kapsamında hangi kurun kullanıldığının
 *      izlenebilir/denetlenebilir olması gerekir).
 *   5. Kategori bazında ve genel toplamda topla.
 */
export const consolidationService = {
  async consolidate(
    requestingTenantId: string,
    query: ConsolidateQuery,
  ): Promise<ConsolidationReport> {
    const parent = await organizationRepository.findById(query.parentOrganizationId);
    if (!parent) throw new NotFoundError("Ana şirket (parent organization)");

    // Konsolidasyon, tenant sınırlarını BİLİNÇLİ olarak aşan tek işlemdir
    // (holding, alt şirketlerin verisini görür). Bu yüzden normal
    // tenant-scope kontrolü yetmez: sadece holding'in KENDİ tenant'ı kendi
    // konsolidasyonunu çalıştırabilir (bkz. organization.repository.ts'teki
    // not — Prisma+RLS'e geçilince bunun karşılığı app_admin/BYPASSRLS'li,
    // dar kapsamlı bir servis rolüdür).
    if (requestingTenantId !== parent.id) {
      throw new ForbiddenError(
        "Bu konsolidasyonu sadece ana şirketin kendisi çalıştırabilir.",
      );
    }

    const descendants = await organizationRepository.findDescendants(parent.id);
    const contributors = [parent, ...descendants];
    const asOfDate = query.asOfDate ?? new Date().toISOString().slice(0, 10);

    const categories = await budgetLineRepository.findCategories();
    const rowsByCategory = new Map<string, ConsolidationRow>(
      categories.map((c) => [
        c.id,
        { categoryId: c.id, categoryName: c.name, totalAmount: 0, byOrganization: [] },
      ]),
    );

    const missingOrganizations: ConsolidationMissingOrg[] = [];

    for (const org of contributors) {
      const scenarios = await scenarioRepository.findMany(org.id, {
        fiscalYear: query.fiscalYear,
        kind: query.scenarioKind,
      });
      const scenario = scenarios[0]; // findMany zaten updatedAt'e göre en yeniden eskiye sıralar.

      if (!scenario) {
        missingOrganizations.push({
          organizationId: org.id,
          organizationName: org.name,
          reason: `${query.fiscalYear} mali yılı için ${query.scenarioKind} senaryosu bulunamadı.`,
        });
        continue;
      }

      const lines = await budgetLineRepository.findByScenario(scenario.id);
      const localTotalsByCategory = new Map<string, number>();
      for (const line of lines) {
        if (line.month < query.periodStart || line.month > query.periodEnd) continue;
        localTotalsByCategory.set(
          line.categoryId,
          roundMoney((localTotalsByCategory.get(line.categoryId) ?? 0) + line.amount),
        );
      }

      for (const [categoryId, localAmount] of localTotalsByCategory) {
        const row = rowsByCategory.get(categoryId);
        if (!row) continue; // Bilinmeyen kategori id'si -> savunmacı biçimde atla.

        const { rate, convertedAmount } = await fxRateService.convert(
          localAmount,
          org.baseCurrency,
          parent.baseCurrency,
          asOfDate,
        );

        row.byOrganization.push({
          organizationId: org.id,
          organizationName: org.name,
          localCurrency: org.baseCurrency,
          localAmount,
          fxRate: rate,
          convertedAmount,
        });
        row.totalAmount = roundMoney(row.totalAmount + convertedAmount);
      }
    }

    const rows = categories.map((c) => rowsByCategory.get(c.id)!);
    const grandTotal = roundMoney(rows.reduce((sum, r) => sum + r.totalAmount, 0));

    return {
      parentOrganizationId: parent.id,
      parentOrganizationName: parent.name,
      parentCurrency: parent.baseCurrency,
      fiscalYear: query.fiscalYear,
      periodStart: query.periodStart,
      periodEnd: query.periodEnd,
      scenarioKind: query.scenarioKind,
      asOfDate,
      rows,
      grandTotal,
      missingOrganizations,
    };
  },
};
