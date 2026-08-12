import { prisma } from "@/backend/core/prisma-client";
import type { PayrollTaxConfig as PayrollTaxConfigRow } from "@prisma/client";

import type { IncomeTaxBracket, PayrollTaxConfig } from "./payroll-calculator";

/**
 * VERİ ERİŞİM KATMANI (Repository) — Prisma/PostgreSQL.
 *
 * `PayrollTaxConfig` KÜRESEL referans veridir (FxRate/BudgetCategory gibi) —
 * RLS YOK, vergi mevzuatı her tenant için aynıdır. Değerler `prisma/seed.ts`
 * içinde, kullanıcının verdiği GERÇEK 2026 rakamlarıyla doldurulur — kod
 * içine GÖMÜLMEZ (bkz. schema.prisma'daki model yorumu).
 */

function toConfig(row: PayrollTaxConfigRow): PayrollTaxConfig {
  return {
    fiscalYear: row.fiscalYear,
    minimumWageGrossMonthlyMinor: Number(row.minimumWageGrossMonthlyMinor),
    sgkCeilingMinor: Number(row.sgkCeilingMinor),
    dailyMealAllowanceExemptMinor: Number(row.dailyMealAllowanceExemptMinor),
    dailyTransportAllowanceExemptMinor: Number(row.dailyTransportAllowanceExemptMinor),
    employeeSgkRate: Number(row.employeeSgkRate),
    employeeUnemploymentRate: Number(row.employeeUnemploymentRate),
    employerSgkRate: Number(row.employerSgkRate),
    employerSgkIncentiveRate: Number(row.employerSgkIncentiveRate),
    employerUnemploymentRate: Number(row.employerUnemploymentRate),
    retiredEmployeeSgdpRate: Number(row.retiredEmployeeSgdpRate),
    retiredEmployerSgdpRate: Number(row.retiredEmployerSgdpRate),
    incomeTaxBrackets: row.incomeTaxBrackets as unknown as IncomeTaxBracket[],
    stampDutyRate: Number(row.stampDutyRate),
    minimumWageIncomeTaxExemptionMonthlyMinor: Number(
      row.minimumWageIncomeTaxExemptionMonthlyMinor,
    ),
    minimumWageStampTaxExemptionMonthlyMinor: Number(
      row.minimumWageStampTaxExemptionMonthlyMinor,
    ),
    disabilityDeductionDegree1Minor: Number(row.disabilityDeductionDegree1Minor),
    disabilityDeductionDegree2Minor: Number(row.disabilityDeductionDegree2Minor),
    disabilityDeductionDegree3Minor: Number(row.disabilityDeductionDegree3Minor),
    standardMonthlyWorkingHours: row.standardMonthlyWorkingHours,
    overtimePremiumMultiplier: Number(row.overtimePremiumMultiplier),
  };
}

export const payrollTaxConfigRepository = {
  async findByFiscalYear(fiscalYear: number): Promise<PayrollTaxConfig | null> {
    const row = await prisma.payrollTaxConfig.findUnique({ where: { fiscalYear } });
    return row ? toConfig(row) : null;
  },
};
