/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Satış Fırsatları (Sales Pipeline) modülü (Faz 3.1) — bkz. backend/modules/sales/.
 *
 * FixedAsset'in AKSİNE onay akışı YOK — canlı bir CRM kaydı. Tek korumalı
 * geçiş: açık aşama -> WON/LOST (bkz. sales-opportunity.service.ts#close).
 */

export type SalesOpportunityStage =
  "LEAD" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";

export const OPEN_SALES_STAGES: SalesOpportunityStage[] = [
  "LEAD",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
];

/** Yeni/düzenlenen bir fırsat SADECE açık bir aşamada oluşturulabilir —
 * WON/LOST'a geçiş yalnızca `close` uç noktasından olur (bkz.
 * backend/modules/sales/sales-opportunity.service.ts). */
export type OpenSalesOpportunityStage =
  "LEAD" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION";

export interface SalesOpportunity {
  id: string;
  tenantId: string;
  customerName: string;
  dealName: string;
  expectedValue: number;
  /** YYYY-MM-DD */
  expectedCloseDate: string;
  stage: SalesOpportunityStage;
  /** Herhangi bir aşamada geçerlidir (FixedAsset'in leasehold-only override kısıtının aksine). */
  winProbabilityOverride: number | null;
  /** YYYY-MM-DD, null = açık. Dolu ise GERÇEK kapanış ayı (expectedCloseDate'ten bağımsız). */
  closedAt: string | null;
  closedByUserName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSalesOpportunityInput {
  customerName: string;
  dealName: string;
  expectedValue: number;
  expectedCloseDate: string;
  stage?: OpenSalesOpportunityStage;
  winProbabilityOverride?: number;
}

export type UpdateSalesOpportunityInput = Partial<CreateSalesOpportunityInput>;

export interface SalesStageConfigEntry {
  stage: SalesOpportunityStage;
  defaultWinProbability: number;
}

export interface SalesBillingMilestone {
  /** YYYY-MM-DD */
  billingDate: string;
  amount: number;
}

export interface SetBillingMilestonesInput {
  milestones: SalesBillingMilestone[];
}

export interface SalesActualsPreviewBreakdown {
  opportunityId: string;
  customerName: string;
  dealName: string;
  /** YYYY-MM-DD — bu satırın kaynaklandığı hakediş faturalama tarihi. */
  billingDate: string;
  month: number;
  amount: number;
}

export interface SalesActualsPreview {
  scenarioId: string;
  fiscalYear: number;
  opportunities: SalesActualsPreviewBreakdown[];
  monthlyTotals: { month: number; totalActual: number }[];
}

export interface SalesPipelineForecastBreakdown {
  opportunityId: string;
  customerName: string;
  dealName: string;
  stage: SalesOpportunityStage;
  winProbability: number;
  month: number;
  weightedAmount: number;
}

export interface SalesPipelineForecastPreview {
  scenarioId: string;
  fiscalYear: number;
  opportunities: SalesPipelineForecastBreakdown[];
  monthlyTotals: { month: number; totalWeighted: number }[];
}
