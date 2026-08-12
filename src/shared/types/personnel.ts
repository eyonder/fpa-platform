/**
 * Frontend ve backend'in ORTAK kullandığı sözleşme (contract).
 * Personel/bordro modülü (Faz 2.1) — bkz. backend/modules/personnel/.
 *
 * ÖNEMLİ: Bu modül SADECE ADMIN'e açıktır (backend/core/authorize.ts'teki
 * payroll:read/payroll:write, BUDGET_MANAGER'a bile VERİLMEZ) — maaş verisi
 * gizliliği roadmap'in açık gereksinimidir.
 */

export type DisabilityDegree = "NONE" | "DEGREE_1" | "DEGREE_2" | "DEGREE_3";

export type CompensationInputMode = "GROSS_FIXED" | "NET_FIXED";

export interface Employee {
  id: string;
  tenantId: string;
  fullName: string;
  position: string;
  department: string | null;
  /** YYYY-MM-DD */
  hireDate: string;
  terminationDate: string | null;
  isActive: boolean;
  isRetired: boolean;
  isConcierge: boolean;
  disabilityDegree: DisabilityDegree;
}

export interface CreateEmployeeInput {
  fullName: string;
  position: string;
  department?: string;
  hireDate: string;
  isRetired?: boolean;
  isConcierge?: boolean;
  disabilityDegree?: DisabilityDegree;
}

/**
 * `amount` DB'de ASLA düz metin değil — `compensationCiphertext` içinde
 * AES-256-GCM şifreli saklanır (bkz. compensation.repository.ts), sadece
 * repository sınırında çözülüp bu domain tipine dönüştürülür.
 */
export interface EmployeeCompensation {
  id: string;
  employeeId: string;
  /** YYYY-MM-DD — bu tarihten itibaren geçerli. */
  effectiveFrom: string;
  inputMode: CompensationInputMode;
  /** GROSS_FIXED ise brüt, NET_FIXED ise net hedef aylık tutar (TRY). */
  amount: number;
  mealAllowanceDays: number;
  transportAllowanceDays: number;
  plannedOvertimeHoursPerMonth: number;
  applyEmployerIncentive: boolean;
}

export interface CreateCompensationInput {
  effectiveFrom: string;
  inputMode: CompensationInputMode;
  amount: number;
  mealAllowanceDays?: number;
  transportAllowanceDays?: number;
  plannedOvertimeHoursPerMonth?: number;
  applyEmployerIncentive?: boolean;
}

/** `POST /api/personnel/payroll-run` önizleme yanıtı — HENÜZ bütçeye YAZILMAZ. */
export interface EmployeeMonthlyBreakdown {
  employeeId: string;
  employeeName: string;
  /** 1-12 */
  month: number;
  grossAmount: number;
  employeeSgkAndUnemployment: number;
  incomeTax: number;
  stampTax: number;
  netAmount: number;
  employerCost: number;
}

export interface MonthlyPayrollTotal {
  month: number;
  totalEmployerCost: number;
}

export interface PayrollRunPreview {
  scenarioId: string;
  fiscalYear: number;
  employees: EmployeeMonthlyBreakdown[];
  monthlyTotals: MonthlyPayrollTotal[];
}
