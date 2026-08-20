import { AppError, NotFoundError } from "@/backend/core/errors";
import type { RequestContext } from "@/backend/core/tenant";
import { roundMoney } from "@/shared/lib/money";
import type {
  SalesBillingMilestone,
  SalesOpportunity,
  SalesOpportunityStage,
  SalesStageConfigEntry,
} from "@/shared/types";

import type {
  CreateSalesOpportunityInput,
  ListSalesOpportunitiesQuery,
  SetBillingMilestonesInput,
  UpdateSalesOpportunityInput,
} from "./sales.schema";
import { salesBillingMilestoneRepository } from "./sales-billing-milestone.repository";
import { salesOpportunityRepository } from "./sales-opportunity.repository";
import { salesStageConfigRepository } from "./sales-stage-config.repository";

// 1 kuruş — money.ts'teki 2 ondalık hassasiyetle uyumlu; upsertAllocationKeySchema'daki
// ±0.01 (orada yüzde puanı) desenini AYNI tolerans büyüklüğüyle yansıtır.
const BILLING_MILESTONE_SUM_TOLERANCE = 0.01;

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * `FixedAsset`/`ExpenseEntry`'nin AKSİNE bir onay akışı durum makinesi YOK —
 * canlı bir CRM kaydı, günlük olarak HER ÜÇ rol tarafından girilir/düzenlenir
 * (bkz. authorize.ts'teki sales-opportunity:write notu). Tek korumalı geçiş:
 * `close` (açık aşama -> WON/LOST) ve onun tersi `reopen`.
 */
export const salesOpportunityService = {
  async list(
    tenantId: string,
    query: ListSalesOpportunitiesQuery,
  ): Promise<SalesOpportunity[]> {
    return salesOpportunityRepository.findByTenant(tenantId, {
      stage: query.stage,
      open: query.open === undefined ? undefined : query.open === "true",
    });
  },

  async get(tenantId: string, id: string): Promise<SalesOpportunity> {
    const opportunity = await salesOpportunityRepository.findById(tenantId, id);
    if (!opportunity) throw new NotFoundError("Satış fırsatı");
    return opportunity;
  },

  async create(
    tenantId: string,
    input: CreateSalesOpportunityInput,
  ): Promise<SalesOpportunity> {
    return salesOpportunityRepository.create(tenantId, input);
  },

  async update(
    tenantId: string,
    id: string,
    input: UpdateSalesOpportunityInput,
  ): Promise<SalesOpportunity> {
    const current = await this.get(tenantId, id);
    assertNotClosed(current);

    const updated = await salesOpportunityRepository.update(tenantId, id, input);
    if (!updated) throw new NotFoundError("Satış fırsatı");
    return updated;
  },

  async close(
    context: RequestContext,
    id: string,
    outcome: "WON" | "LOST",
  ): Promise<SalesOpportunity> {
    const opportunity = await this.get(context.tenantId, id);
    assertNotClosed(opportunity);

    if (outcome === "WON") {
      // Hakediş faturalama tarihleri WON'a kapatmadan ÖNCE (açıkken)
      // girilmiş olmalı — bkz. sales.ts'teki dosya başı notu ve
      // setBillingMilestones (assertNotClosed nedeniyle kapandıktan SONRA
      // milestone eklenemez, yeniden açılması gerekir).
      const milestones = await salesBillingMilestoneRepository.findByOpportunity(
        context.tenantId,
        id,
      );
      assertHasBillingMilestones(milestones);
      assertMilestonesSumMatches(opportunity, milestones);
    }

    const updated = await salesOpportunityRepository.transitionToClosed(
      context.tenantId,
      id,
      outcome,
      context.userId,
      context.userName,
    );
    if (!updated) throw new NotFoundError("Satış fırsatı");
    return updated;
  },

  async reopen(context: RequestContext, id: string): Promise<SalesOpportunity> {
    const opportunity = await this.get(context.tenantId, id);
    assertClosed(opportunity);

    const updated = await salesOpportunityRepository.transitionToReopened(
      context.tenantId,
      id,
    );
    if (!updated) throw new NotFoundError("Satış fırsatı");
    return updated;
  },

  async getBillingMilestones(
    tenantId: string,
    id: string,
  ): Promise<SalesBillingMilestone[]> {
    await this.get(tenantId, id); // yoksa 404
    return salesBillingMilestoneRepository.findByOpportunity(tenantId, id);
  },

  /** Milestone listesini TAMAMEN değiştirir (bkz. sales-billing-milestone.repository.ts).
   * Boş liste geçerlidir (henüz planlanmadı) — SADECE dolu bir liste toplam
   * kontrolüne tabidir; WON'a kapatmadan önce en az bir tane ZORUNLU olması
   * ayrı bir kontrol (bkz. close()). */
  async setBillingMilestones(
    tenantId: string,
    id: string,
    input: SetBillingMilestonesInput,
  ): Promise<SalesBillingMilestone[]> {
    const opportunity = await this.get(tenantId, id); // yoksa 404
    assertNotClosed(opportunity);

    if (input.milestones.length > 0) {
      assertMilestonesSumMatches(opportunity, input.milestones);
    }

    return salesBillingMilestoneRepository.replaceAll(tenantId, id, input);
  },
};

function assertNotClosed(opportunity: SalesOpportunity): void {
  if (opportunity.closedAt) {
    throw new AppError(
      "SALES_OPPORTUNITY_CLOSED",
      "Kapatılmış (Kazanıldı/Kaybedildi) bir satış fırsatı düzenlenemez. Önce yeniden açın.",
      409,
    );
  }
}

function assertClosed(opportunity: SalesOpportunity): void {
  if (!opportunity.closedAt) {
    throw new AppError(
      "SALES_OPPORTUNITY_NOT_CLOSED",
      "Bu işlem yalnızca kapatılmış (Kazanıldı/Kaybedildi) fırsatlar için yapılabilir.",
      409,
    );
  }
}

function assertHasBillingMilestones(milestones: SalesBillingMilestone[]): void {
  if (milestones.length === 0) {
    throw new AppError(
      "SALES_OPPORTUNITY_MISSING_BILLING_MILESTONES",
      "Kazanıldı (WON) olarak kapatmadan önce en az bir hakediş faturalama tarihi eklenmelidir.",
      409,
    );
  }
}

/** Milestone tutarları toplamı fırsatın expectedValue'suna (±1 kuruş
 * tolerans) eşit olmalı — hem kayıt anında (dolu bir liste için) hem de
 * WON'a kapatırken (expectedValue milestone'lardan SONRA değişmiş olabilir,
 * bkz. update() — bu yüzden kapatırken TEKRAR kontrol edilir). */
function assertMilestonesSumMatches(
  opportunity: SalesOpportunity,
  milestones: { amount: number }[],
): void {
  const total = roundMoney(milestones.reduce((sum, m) => sum + m.amount, 0));
  if (Math.abs(total - opportunity.expectedValue) > BILLING_MILESTONE_SUM_TOLERANCE) {
    throw new AppError(
      "SALES_BILLING_MILESTONES_SUM_MISMATCH",
      `Hakediş tutarları toplamı (${total}) fırsatın beklenen tutarıyla (${opportunity.expectedValue}) eşleşmiyor.`,
      422,
    );
  }
}

/** override ?? aşamanın küresel varsayılan olasılığı — HERHANGİ bir aşamada
 * geçerlidir (FixedAsset'in leasehold-only override kısıtının AKSİNE). */
export function resolveWinProbability(
  stage: SalesOpportunityStage,
  winProbabilityOverride: number | null | undefined,
  stageConfigByStage: Map<SalesOpportunityStage, SalesStageConfigEntry>,
): number {
  if (winProbabilityOverride !== null && winProbabilityOverride !== undefined) {
    return winProbabilityOverride;
  }

  const config = stageConfigByStage.get(stage);
  if (!config) {
    throw new AppError(
      "SALES_STAGE_CONFIG_MISSING",
      `"${stage}" aşaması için varsayılan kazanma olasılığı tanımlı değil.`,
      409,
    );
  }
  return config.defaultWinProbability;
}

export async function loadSalesStageConfigMap(): Promise<
  Map<SalesOpportunityStage, SalesStageConfigEntry>
> {
  const rows = await salesStageConfigRepository.findAll();
  return new Map(rows.map((r) => [r.stage, r]));
}
