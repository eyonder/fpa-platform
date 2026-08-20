import { AppError, NotFoundError } from "@/backend/core/errors";
import type { RequestContext } from "@/backend/core/tenant";
import type {
  SalesOpportunity,
  SalesOpportunityStage,
  SalesStageConfigEntry,
} from "@/shared/types";

import type {
  CreateSalesOpportunityInput,
  ListSalesOpportunitiesQuery,
  UpdateSalesOpportunityInput,
} from "./sales.schema";
import { salesOpportunityRepository } from "./sales-opportunity.repository";
import { salesStageConfigRepository } from "./sales-stage-config.repository";

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
