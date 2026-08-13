/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Sabit Kıymetler / Amortisman modülü (Faz 2.3) — bkz. backend/modules/fixed-assets/.
 *
 * v1 SADECE VUK/TDHP kapsar — bkz. prisma/schema.prisma'daki 12. bölüm notu.
 */

export type FixedAssetCategory =
  | "BUILDINGS"
  | "MACHINERY_EQUIPMENT"
  | "VEHICLES"
  | "FURNITURE_FIXTURES"
  | "COMPUTER_HARDWARE"
  | "LEASEHOLD_IMPROVEMENTS";

export type FixedAssetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

/** Yıl 1'den başlar — yıl 0 (ilk yatırım, -baseValue) NPV/IRR hesaplamasında
 * otomatik eklenir, burada saklanmaz (bkz. npv-irr.ts). */
export interface CashFlowProjectionEntry {
  year: number;
  amount: number;
}

export interface FixedAsset {
  id: string;
  tenantId: string;
  assetName: string;
  category: FixedAssetCategory;
  /** YYYY-MM-DD */
  acquisitionDate: string;
  baseValue: number;
  /** SADECE LEASEHOLD_IMPROVEMENTS için anlamlıdır. */
  usefulLifeYearsOverride: number | null;
  cashFlowProjection: CashFlowProjectionEntry[];
  discountRate: number;
  description: string | null;
  status: FixedAssetStatus;
  submittedByUserName: string | null;
  submittedAt: string | null;
  decidedByUserName: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  updatedAt: string;
}

export interface CreateFixedAssetInput {
  assetName: string;
  category: FixedAssetCategory;
  acquisitionDate: string;
  baseValue: number;
  usefulLifeYearsOverride?: number;
  cashFlowProjection: CashFlowProjectionEntry[];
  discountRate: number;
  description?: string;
}

export type UpdateFixedAssetInput = Partial<CreateFixedAssetInput>;

export interface FixedAssetFeasibility {
  npv: number;
  /** Kök bulunamazsa (nakit akışları işaret değiştirmiyorsa) null. */
  irr: number | null;
}

export interface DepreciationScheduleMonth {
  year: number;
  /** 1-12 */
  month: number;
  /** 1'den başlayan sıra no — programın toplam kaç ay sürdüğünü doğrulamak için. */
  sequenceNumber: number;
  amount: number;
}

export interface DepreciationPreviewAssetBreakdown {
  fixedAssetId: string;
  assetName: string;
  monthlyAmounts: { month: number; amount: number }[];
}

export interface DepreciationPreview {
  scenarioId: string;
  fiscalYear: number;
  assets: DepreciationPreviewAssetBreakdown[];
  monthlyTotals: { month: number; totalDepreciation: number }[];
}

export interface VukAmortismanConfigEntry {
  category: FixedAssetCategory;
  usefulLifeYears: number;
  annualRate: number;
  vukReference: string;
}
