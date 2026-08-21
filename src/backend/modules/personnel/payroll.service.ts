import { AppError, NotFoundError } from "@/backend/core/errors";
import type { RequestContext } from "@/backend/core/tenant";
import { budgetLineRepository } from "@/backend/modules/budget-lines/budget-line.repository";
import { budgetLineService } from "@/backend/modules/budget-lines/budget-line.service";
import { scenarioRepository } from "@/backend/modules/scenarios/scenario.repository";
import { fromMinorUnits, roundMoney, toMinorUnits } from "@/shared/lib/money";
import type {
  BudgetLine,
  BudgetLineInput,
  Employee,
  EmployeeMonthlyBreakdown,
  MonthlyPayrollCashTotal,
  PayrollCashAggregate,
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
 * `preview` KİŞİ KIRILIMI döndürür ve `payroll:read` (SADECE ADMIN, kişisel
 * veri gizliliği) ile korunur. `previewAggregate` ise SADECE şirket düzeyinde
 * aylık toplamları döndürür — kişisel veri içermez, bu yüzden Hazine
 * projeksiyonu onu `treasury:read` altında kullanabilir (bkz.
 * treasury-projection.service.ts). İkisi de AYNI hesap motorunu çağırır;
 * Hazine'nin Türk SGK/gelir vergisi mantığını KENDİ İÇİNDE yeniden yazması
 * ilk yasal oran değişiminde sessizce ayrışmak demek olurdu.
 *
 * `preview` HİÇBİR ŞEY YAZMAZ — sadece hesaplar. `commitToBudget` bu önizlemeyi
 * TEKRAR HESAPLAYIP (state saklamadan, basitlik için) toplam işveren maliyetini
 * ayl(k olarak "Personel Giderleri" (`cat-personel`) kategorisine, TEK bütçe
 * yazma noktası olan `budgetLineService.bulkUpsert` üzerinden yazar — kilit
 * kontrolü ve audit kaydı (source: PAYROLL) oradan otomatik gelir, burada
 * TEKRAR uygulanmaz.
 */

/** KOD (id DEĞİL) — bkz. depreciation.service.ts. */
const PERSONNEL_CATEGORY_CODE = "cat-personel";

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

/**
 * What-If için bordro çarpanı. `PAYROLL_RAISE` düzeltmesi çıktıyı 1.30 ile
 * ÇARPARAK taklit EDİLEMEZ: Türk gelir vergisi artan oranlıdır ve kümülatif
 * matrah dilim aşımı yaratır, yani %30 zam net/vergi bileşenlerini DOĞRUSAL
 * OLMAYAN biçimde değiştirir. Bu yüzden çarpan ücretin KENDİSİNE uygulanır
 * ve motor yeniden çalıştırılır.
 */
export interface PayrollSimulationOptions {
  /** 1.30 = %30 zam. */
  grossMultiplier: number;
  /** 1-12; bu ay ve SONRASI etkilenir. */
  effectiveFromMonth: number;
}

export interface PayrollPreviewOptions {
  simulation?: PayrollSimulationOptions;
}

export const payrollService = {
  async preview(
    context: RequestContext,
    scenarioId: string,
    options?: PayrollPreviewOptions,
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

        // Simülasyon çarpanı ÜCRETE uygulanır (GROSS_FIXED'te brüte,
        // NET_FIXED'te hedef nete) — motor sonrasında değil, ÖNCESİNDE.
        const simulatedAmount =
          options?.simulation && month >= options.simulation.effectiveFromMonth
            ? compensation.amount * options.simulation.grossMultiplier
            : compensation.amount;

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
                { baseGrossMinor: toMinorUnits(simulatedAmount), ...inputs },
                cumulativeTaxBaseMinor,
                config,
              )
            : netToGross(
                profile,
                toMinorUnits(simulatedAmount),
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

  /**
   * Hazine projeksiyonunun kullandığı KİŞİSEL VERİSİZ kapı.
   *
   * `preview`in AYNI motorunu çağırır, sonra kişi kırılımını ATAR ve sadece
   * aylık şirket toplamlarını döndürür. Nakit ayrımı KASITLI: net maaşlar ve
   * yasal kesintiler AYNI ayda ama FARKLI günlerde ödenir (bkz.
   * treasury-derivations.ts) — tek kalem olarak vermek 90 günlük bir ödeme
   * gücü tablosunda anlamlı bir hata olurdu.
   *
   * `totalStatutory = employerCost - net` özdeşliğinden türetilir: brüt =
   * net + işçi SGK + gelir + damga olduğundan, işveren maliyetinden neti
   * çıkarmak TÜM yasal yükü (işveren payı dahil) verir.
   */
  async previewAggregate(
    context: RequestContext,
    scenarioId: string,
    options?: PayrollPreviewOptions,
  ): Promise<PayrollCashAggregate> {
    const preview = await this.preview(context, scenarioId, options);

    const byMonth = new Map<number, { net: number; employerCost: number }>();
    for (const row of preview.employees) {
      const bucket = byMonth.get(row.month) ?? { net: 0, employerCost: 0 };
      bucket.net += row.netAmount;
      bucket.employerCost += row.employerCost;
      byMonth.set(row.month, bucket);
    }

    const months: MonthlyPayrollCashTotal[] = [...byMonth.entries()]
      .sort(([a], [b]) => a - b)
      .map(([month, bucket]) => ({
        month,
        totalNet: roundMoney(bucket.net),
        totalStatutory: roundMoney(bucket.employerCost - bucket.net),
        totalEmployerCost: roundMoney(bucket.employerCost),
      }));

    return { scenarioId, fiscalYear: preview.fiscalYear, months };
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

    const personnelCategoryId = await resolvePersonnelCategoryId(context.tenantId);

    const lines: BudgetLineInput[] = preview.monthlyTotals.map((t) => ({
      categoryId: personnelCategoryId,
      month: t.month,
      amount: t.totalEmployerCost,
    }));

    return budgetLineService.bulkUpsert(context, scenarioId, lines, "PAYROLL");
  },
};

/** Sabit kategori KODUNU bu tenant'taki id'ye çevirir. Kategori yoksa 409:
 * sessizce atlamak, bütçeye hiç yazmadan "başarılı" dönmek olurdu. */
async function resolvePersonnelCategoryId(tenantId: string): Promise<string> {
  const category = await budgetLineRepository.findCategoryByCode(
    tenantId,
    PERSONNEL_CATEGORY_CODE,
  );
  if (!category) {
    throw new AppError(
      "BUDGET_CATEGORY_NOT_FOUND",
      `Bu şirkette "${PERSONNEL_CATEGORY_CODE}" kodlu bütçe kategorisi tanımlı değil.`,
      409,
    );
  }
  return category.id;
}
