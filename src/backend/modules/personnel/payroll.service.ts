import { AppError, NotFoundError } from "@/backend/core/errors";
import type { RequestContext } from "@/backend/core/tenant";
import { budgetLineService } from "@/backend/modules/budget-lines/budget-line.service";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import { fromMinorUnits, roundMoney, toMinorUnits } from "@/shared/lib/money";
import type {
  BudgetLine,
  BudgetLineInput,
  Employee,
  EmployeeMonthlyBreakdown,
  PayrollRunPreview,
} from "@/shared/types";

import { compensationRepository } from "./compensation.repository";
import { employeeRepository } from "./employee.repository";
import { grossToNet, netToGross } from "./payroll-calculator";
import type { EmployeeTaxProfile } from "./payroll-calculator";
import { payrollTaxConfigRepository } from "./payroll-tax-config.repository";

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * `preview` HİÇBİR ŞEY YAZMAZ — sadece hesaplar. `commitToBudget` bu önizlemeyi
 * TEKRAR HESAPLAYIP (state saklamadan, basitlik için) toplam işveren maliyetini
 * ayl(k olarak "Personel Giderleri" (`cat-personel`) kategorisine, TEK bütçe
 * yazma noktası olan `budgetLineService.bulkUpsert` üzerinden yazar — kilit
 * kontrolü ve audit kaydı (source: PAYROLL) oradan otomatik gelir, burada
 * TEKRAR uygulanmaz.
 */

const PERSONNEL_CATEGORY_ID = "cat-personel";

function monthStartDate(fiscalYear: number, month: number): string {
  return `${fiscalYear}-${String(month).padStart(2, "0")}-01`;
}

function monthEndDate(fiscalYear: number, month: number): string {
  // Ayın son günü tam olarak gerekmiyor — sadece "bu ay İÇİNDE mi" testi
  // için bir sonraki ayın 1'inden ÖNCEKİ gün yeterli, o yüzden bir sonraki
  // ayın ilk gününü döneriz ve karşılaştırmayı `<` ile yaparız.
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? fiscalYear + 1 : fiscalYear;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

function isEmployedDuringMonth(
  employee: Employee,
  fiscalYear: number,
  month: number,
): boolean {
  const monthStart = monthStartDate(fiscalYear, month);
  const monthEndExclusive = monthEndDate(fiscalYear, month);
  if (employee.hireDate >= monthEndExclusive) return false;
  if (employee.terminationDate && employee.terminationDate < monthStart) return false;
  return true;
}

export const payrollService = {
  async preview(
    context: RequestContext,
    scenarioId: string,
  ): Promise<PayrollRunPreview> {
    const scenario = await scenarioRepository.findById(context.tenantId, scenarioId);
    if (!scenario) throw new NotFoundError("Senaryo");

    const config = await payrollTaxConfigRepository.findByFiscalYear(
      scenario.fiscalYear,
    );
    if (!config) {
      throw new AppError(
        "PAYROLL_TAX_CONFIG_MISSING",
        `${scenario.fiscalYear} mali yılı için vergi/SGK parametreleri tanımlı değil.`,
        409,
      );
    }

    const employees = await employeeRepository.findActive(context.tenantId);
    const breakdown: EmployeeMonthlyBreakdown[] = [];
    const totalsByMonth = new Map<number, number>();

    for (const employee of employees) {
      const profile: EmployeeTaxProfile = {
        isRetired: employee.isRetired,
        isConcierge: employee.isConcierge,
        disabilityDegree: employee.disabilityDegree,
      };

      // Kümülatif vergi matrahı, mali yıl boyunca AYLAR SIRAYLA işlenerek
      // taşınır — dilim aşımının doğru hesaplanması için ŞART (bkz.
      // payroll-calculator.ts'teki yorum).
      let cumulativeTaxBaseMinor = 0;

      for (let month = 1; month <= 12; month++) {
        if (!isEmployedDuringMonth(employee, scenario.fiscalYear, month)) continue;

        const asOfDate = monthStartDate(scenario.fiscalYear, month);
        const compensation = await compensationRepository.findEffectiveAsOf(
          context.tenantId,
          employee.id,
          asOfDate,
        );
        if (!compensation) continue; // henüz ücret kaydı girilmemiş

        const inputs = {
          overtimeHours: compensation.plannedOvertimeHoursPerMonth,
          mealAllowanceDays: compensation.mealAllowanceDays,
          transportAllowanceDays: compensation.transportAllowanceDays,
          applyEmployerIncentive: compensation.applyEmployerIncentive,
        };

        const result =
          compensation.inputMode === "GROSS_FIXED"
            ? grossToNet(
                profile,
                { baseGrossMinor: toMinorUnits(compensation.amount), ...inputs },
                cumulativeTaxBaseMinor,
                config,
              )
            : netToGross(
                profile,
                toMinorUnits(compensation.amount),
                inputs,
                cumulativeTaxBaseMinor,
                config,
              );

        cumulativeTaxBaseMinor = result.cumulativeTaxBaseAfterMinor;

        breakdown.push({
          employeeId: employee.id,
          employeeName: employee.fullName,
          month,
          grossAmount: fromMinorUnits(result.totalGrossMinor),
          employeeSgkAndUnemployment: fromMinorUnits(
            result.employeeSgkAndUnemploymentMinor,
          ),
          incomeTax: fromMinorUnits(result.incomeTaxMinor),
          stampTax: fromMinorUnits(result.stampTaxMinor),
          netAmount: fromMinorUnits(result.netMonthlyMinor),
          employerCost: fromMinorUnits(result.employerCostMinor),
        });

        totalsByMonth.set(
          month,
          roundMoney(
            (totalsByMonth.get(month) ?? 0) + fromMinorUnits(result.employerCostMinor),
          ),
        );
      }
    }

    const monthlyTotals = [...totalsByMonth.entries()]
      .sort(([a], [b]) => a - b)
      .map(([month, totalEmployerCost]) => ({ month, totalEmployerCost }));

    return {
      scenarioId,
      fiscalYear: scenario.fiscalYear,
      employees: breakdown,
      monthlyTotals,
    };
  },

  async commitToBudget(
    context: RequestContext,
    scenarioId: string,
  ): Promise<BudgetLine[]> {
    const preview = await this.preview(context, scenarioId);

    if (preview.monthlyTotals.length === 0) {
      throw new AppError(
        "PAYROLL_NO_DATA",
        "Bütçeye yazılacak veri yok — aktif personel veya ücret kaydı bulunamadı.",
        422,
      );
    }

    const lines: BudgetLineInput[] = preview.monthlyTotals.map((t) => ({
      categoryId: PERSONNEL_CATEGORY_ID,
      month: t.month,
      amount: t.totalEmployerCost,
    }));

    return budgetLineService.bulkUpsert(context, scenarioId, lines, "PAYROLL");
  },
};
