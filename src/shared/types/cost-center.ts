/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Gider Merkezleri modülü (Faz 2.2) — bkz. backend/modules/cost-centers/.
 *
 * "Gider türü" için AYRI bir model YOK — mevcut BudgetCategory (type:
 * EXPENSE) doğrudan kullanılır (bkz. prisma/schema.prisma'daki 11. bölüm notu).
 */

export interface CostCenter {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  parentCostCenterId: string | null;
}

export interface CreateCostCenterInput {
  code: string;
  name: string;
  parentCostCenterId?: string | null;
}

export interface UpdateCostCenterInput {
  code?: string;
  name?: string;
  parentCostCenterId?: string | null;
}

export interface AllocationKeyMember {
  costCenterId: string;
  /** 0-100, bir anahtarın üyeleri toplamda 100 etmeli. */
  weightPercent: number;
}

/** Bir kaynak gider merkezinin maliyetini üye gider merkezlerine SABİT %
 * ağırlıkla dağıtan anahtar — bkz. expense-allocation.ts. Sadece raporlama
 * amaçlıdır, BudgetLine'a yazılan tutarı DEĞİŞTİRMEZ. */
export interface AllocationKey {
  id: string;
  sourceCostCenterId: string;
  name: string;
  members: AllocationKeyMember[];
}

export interface UpsertAllocationKeyInput {
  name: string;
  members: AllocationKeyMember[];
}
