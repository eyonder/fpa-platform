import type { ScenarioKind } from "./scenario";

/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Çok şirketli (holding) konsolidasyon raporu: alt şirketlerin kendi para
 * biriminde tuttuğu bütçe kalemleri, ana şirketin para birimine çevrilip
 * kategori bazında toplanır.
 */

export interface ConsolidationOrgBreakdown {
  organizationId: string;
  organizationName: string;
  localCurrency: string;
  /** Alt şirketin kendi para biriminde, dönem toplamı. */
  localAmount: number;
  /** localCurrency -> parentCurrency için kullanılan kur. */
  fxRate: number;
  /** localAmount * fxRate (ana şirket para biriminde). */
  convertedAmount: number;
}

export interface ConsolidationRow {
  categoryId: string;
  categoryName: string;
  /** Tüm şirketlerin ana şirket para biriminde toplamı. */
  totalAmount: number;
  byOrganization: ConsolidationOrgBreakdown[];
}

export interface ConsolidationMissingOrg {
  organizationId: string;
  organizationName: string;
  reason: string;
}

export interface ConsolidationReport {
  parentOrganizationId: string;
  parentOrganizationName: string;
  parentCurrency: string;
  fiscalYear: number;
  periodStart: number;
  periodEnd: number;
  scenarioKind: ScenarioKind;
  /** Kur çevriminde kullanılan tarih (YYYY-MM-DD). */
  asOfDate: string;
  rows: ConsolidationRow[];
  grandTotal: number;
  /** Bu mali yıl/tür için senaryosu bulunamayan (henüz veri girmemiş) şirketler. */
  missingOrganizations: ConsolidationMissingOrg[];
}
