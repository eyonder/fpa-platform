/**
 * SAF (framework'ten bağımsız, DB'siz) Türkiye bordro hesap motoru.
 *
 * Tüm tutarlar KURUŞ (integer minor unit, `number`) bazındadır — money.ts'teki
 * toMinorUnits/fromMinorUnits ile repository sınırında major birime (TRY)
 * çevrilir; BigInt'e çevrim ise Prisma repository sınırında yapılır (bkz.
 * budget-line.repository.ts'teki aynı disiplin).
 *
 * Kümülatif gelir vergisi matrahı (KGVM) doğru şekilde modellenir: bir ayın
 * vergisi, O AYA KADAR olan kümülatif matrah üzerinden dilim aşımı (bracket
 * creep) hesaba katılarak bulunur — `netToGross`/`grossToNet` bu yüzden
 * `cumulativeTaxBaseBeforeMinor` parametresini alır ve çağıran (payroll.service.ts)
 * ayları SIRAYLA (Ocak→Aralık) işleyip bu değeri taşımalıdır.
 *
 * ÖNEMLİ VARSAYIMLAR (bilinçli basitleştirmeler — bkz. proje sohbetindeki not):
 *  - Yemek/yol istisnası: TAM istisna tavanında ödendiği varsayılır (tavan
 *    üstü ödeme senaryosu MODELLENMEZ).
 *  - İşveren SGK teşviki (5 puan): gerçek uygunluk (borç durumu vb.) kontrol
 *    EDİLMEZ — `applyEmployerIncentive` girdisiyle açık bir varsayımdır.
 *  - Fazla mesai: gerçek puantaj değil, planlama amaçlı aylık TAHMİNİ saattir.
 *  - Kıdem tazminatı tavanı (PayrollTaxConfig'te saklanır) bu motorda
 *    KULLANILMAZ — kıdem tazminatı tahakkuku ayrı, henüz yapılmamış bir özelliktir.
 */

export type DisabilityDegree = "NONE" | "DEGREE_1" | "DEGREE_2" | "DEGREE_3";

export interface IncomeTaxBracket {
  /** Bu dilimin ÜST sınırı (yıllık kümülatif matrah, kuruş) — son dilimde `null` (sınırsız). */
  uptoAnnualMinor: number | null;
  rate: number;
}

export interface PayrollTaxConfig {
  fiscalYear: number;
  minimumWageGrossMonthlyMinor: number;
  sgkCeilingMinor: number;
  dailyMealAllowanceExemptMinor: number;
  dailyTransportAllowanceExemptMinor: number;
  employeeSgkRate: number;
  employeeUnemploymentRate: number;
  employerSgkRate: number;
  employerSgkIncentiveRate: number;
  employerUnemploymentRate: number;
  retiredEmployeeSgdpRate: number;
  retiredEmployerSgdpRate: number;
  incomeTaxBrackets: IncomeTaxBracket[];
  stampDutyRate: number;
  minimumWageIncomeTaxExemptionMonthlyMinor: number;
  minimumWageStampTaxExemptionMonthlyMinor: number;
  disabilityDeductionDegree1Minor: number;
  disabilityDeductionDegree2Minor: number;
  disabilityDeductionDegree3Minor: number;
  standardMonthlyWorkingHours: number;
  overtimePremiumMultiplier: number;
}

export interface EmployeeTaxProfile {
  isRetired: boolean;
  isConcierge: boolean;
  disabilityDegree: DisabilityDegree;
}

export interface MonthlyPayInputs {
  baseGrossMinor: number;
  overtimeHours: number;
  mealAllowanceDays: number;
  transportAllowanceDays: number;
  applyEmployerIncentive: boolean;
}

export interface MonthlyPayResult {
  baseGrossMinor: number;
  overtimeGrossMinor: number;
  totalGrossMinor: number;
  sgkBaseMinor: number;
  employeeSgkAndUnemploymentMinor: number;
  cumulativeTaxBaseBeforeMinor: number;
  cumulativeTaxBaseAfterMinor: number;
  incomeTaxBeforeExemptionMinor: number;
  incomeTaxExemptionMinor: number;
  incomeTaxMinor: number;
  stampTaxBeforeExemptionMinor: number;
  stampTaxExemptionMinor: number;
  stampTaxMinor: number;
  mealAllowanceMinor: number;
  transportAllowanceMinor: number;
  netMonthlyMinor: number;
  employerSgkAndUnemploymentMinor: number;
  employerCostMinor: number;
}

function disabilityDeductionMinor(
  degree: DisabilityDegree,
  config: PayrollTaxConfig,
): number {
  switch (degree) {
    case "DEGREE_1":
      return config.disabilityDeductionDegree1Minor;
    case "DEGREE_2":
      return config.disabilityDeductionDegree2Minor;
    case "DEGREE_3":
      return config.disabilityDeductionDegree3Minor;
    default:
      return 0;
  }
}

/** Kümülatif dilimli (artan oranlı) vergiyi, verilen matrah için TOPLAM olarak hesaplar. */
function cumulativeBracketTax(baseMinor: number, brackets: IncomeTaxBracket[]): number {
  if (baseMinor <= 0) return 0;

  let tax = 0;
  let lower = 0;
  for (const bracket of brackets) {
    const upper = bracket.uptoAnnualMinor ?? Infinity;
    if (baseMinor <= lower) break;
    const amountInBracket = Math.min(baseMinor, upper) - lower;
    if (amountInBracket > 0) tax += amountInBracket * bracket.rate;
    lower = upper;
  }
  return Math.round(tax);
}

/**
 * Brüt → net. `cumulativeTaxBaseBeforeMinor`, mali yılın bu aya KADAR olan
 * (bu ay HARİÇ) kümülatif gelir vergisi matrahıdır — dilim aşımının doğru
 * hesaplanması için şart.
 */
export function grossToNet(
  profile: EmployeeTaxProfile,
  inputs: MonthlyPayInputs,
  cumulativeTaxBaseBeforeMinor: number,
  config: PayrollTaxConfig,
): MonthlyPayResult {
  const hourlyGrossMinor = inputs.baseGrossMinor / config.standardMonthlyWorkingHours;
  const overtimeGrossMinor = Math.round(
    hourlyGrossMinor * config.overtimePremiumMultiplier * inputs.overtimeHours,
  );
  const totalGrossMinor = inputs.baseGrossMinor + overtimeGrossMinor;

  // SGK tavanı: taban+mesai TOPLAMI tavanla sınırlanır (standart SGK
  // uygulaması — tavan üstü kazanç prime tabi değildir).
  const sgkBaseMinor = Math.min(totalGrossMinor, config.sgkCeilingMinor);

  const employeeSgkCombinedRate = profile.isRetired
    ? config.retiredEmployeeSgdpRate
    : config.employeeSgkRate + config.employeeUnemploymentRate;
  const employeeSgkAndUnemploymentMinor = Math.round(
    sgkBaseMinor * employeeSgkCombinedRate,
  );

  const taxBaseDeltaMinor = Math.max(
    0,
    totalGrossMinor -
      employeeSgkAndUnemploymentMinor -
      disabilityDeductionMinor(profile.disabilityDegree, config),
  );
  const cumulativeTaxBaseAfterMinor = cumulativeTaxBaseBeforeMinor + taxBaseDeltaMinor;

  let incomeTaxBeforeExemptionMinor = 0;
  let incomeTaxExemptionMinor = 0;
  let incomeTaxMinor = 0;
  let stampTaxBeforeExemptionMinor = 0;
  let stampTaxExemptionMinor = 0;
  let stampTaxMinor = 0;

  if (!profile.isConcierge) {
    // Bu ayın vergisi = (0..kümülatif-SONRA vergi) - (0..kümülatif-ÖNCE vergi)
    // — dilim aşımını doğru yansıtan standart Türkiye kümülatif stopaj yöntemi.
    const taxOwedThroughAfter = cumulativeBracketTax(
      cumulativeTaxBaseAfterMinor,
      config.incomeTaxBrackets,
    );
    const taxOwedThroughBefore = cumulativeBracketTax(
      cumulativeTaxBaseBeforeMinor,
      config.incomeTaxBrackets,
    );
    incomeTaxBeforeExemptionMinor = taxOwedThroughAfter - taxOwedThroughBefore;
    incomeTaxExemptionMinor = Math.min(
      incomeTaxBeforeExemptionMinor,
      config.minimumWageIncomeTaxExemptionMonthlyMinor,
    );
    incomeTaxMinor = Math.max(
      0,
      incomeTaxBeforeExemptionMinor - incomeTaxExemptionMinor,
    );

    stampTaxBeforeExemptionMinor = Math.round(totalGrossMinor * config.stampDutyRate);
    stampTaxExemptionMinor = Math.min(
      stampTaxBeforeExemptionMinor,
      config.minimumWageStampTaxExemptionMonthlyMinor,
    );
    stampTaxMinor = Math.max(0, stampTaxBeforeExemptionMinor - stampTaxExemptionMinor);
  }
  // Kapıcı: gelir + damga vergisi TAM MUAF (yukarıdaki üçü sıfır kalır),
  // sadece SGK kesintisi uygulanır — yukarıda zaten hesaplandı.

  const mealAllowanceMinor = Math.round(
    inputs.mealAllowanceDays * config.dailyMealAllowanceExemptMinor,
  );
  const transportAllowanceMinor = Math.round(
    inputs.transportAllowanceDays * config.dailyTransportAllowanceExemptMinor,
  );

  const netMonthlyMinor =
    totalGrossMinor -
    employeeSgkAndUnemploymentMinor -
    incomeTaxMinor -
    stampTaxMinor +
    mealAllowanceMinor +
    transportAllowanceMinor;

  const employerSgkCombinedRate = profile.isRetired
    ? config.retiredEmployerSgdpRate
    : (inputs.applyEmployerIncentive
        ? config.employerSgkRate - config.employerSgkIncentiveRate
        : config.employerSgkRate) + config.employerUnemploymentRate;
  const employerSgkAndUnemploymentMinor = Math.round(
    sgkBaseMinor * employerSgkCombinedRate,
  );
  const employerCostMinor = totalGrossMinor + employerSgkAndUnemploymentMinor;

  return {
    baseGrossMinor: inputs.baseGrossMinor,
    overtimeGrossMinor,
    totalGrossMinor,
    sgkBaseMinor,
    employeeSgkAndUnemploymentMinor,
    cumulativeTaxBaseBeforeMinor,
    cumulativeTaxBaseAfterMinor,
    incomeTaxBeforeExemptionMinor,
    incomeTaxExemptionMinor,
    incomeTaxMinor,
    stampTaxBeforeExemptionMinor,
    stampTaxExemptionMinor,
    stampTaxMinor,
    mealAllowanceMinor,
    transportAllowanceMinor,
    netMonthlyMinor,
    employerSgkAndUnemploymentMinor,
    employerCostMinor,
  };
}

/**
 * Net → brüt. SGK tavanı + kümülatif dilimli vergi nedeniyle kapalı formülle
 * (cebirsel ters çevirme) çözülemez — `grossToNet` üzerinde ikili arama
 * (bisection) ile çözülür. `grossToNet`, brüt arttıkça net'in KESİN AZALMAYAN
 * (monoton artan) olmasını garanti eder (hiçbir marjinal kesinti oranı
 * %100'ü geçmez), bu yüzden ikili arama güvenlidir.
 */
export function netToGross(
  profile: EmployeeTaxProfile,
  netTargetMinor: number,
  otherInputs: Omit<MonthlyPayInputs, "baseGrossMinor">,
  cumulativeTaxBaseBeforeMinor: number,
  config: PayrollTaxConfig,
): MonthlyPayResult {
  let low = netTargetMinor;
  let high = netTargetMinor * 3 + 100_000; // cömert üst sınır (kuruş)
  let result = grossToNet(
    profile,
    { ...otherInputs, baseGrossMinor: high },
    cumulativeTaxBaseBeforeMinor,
    config,
  );

  for (
    let i = 0;
    i < 60 && Math.abs(result.netMonthlyMinor - netTargetMinor) > 1;
    i++
  ) {
    const mid = Math.round((low + high) / 2);
    result = grossToNet(
      profile,
      { ...otherInputs, baseGrossMinor: mid },
      cumulativeTaxBaseBeforeMinor,
      config,
    );
    if (result.netMonthlyMinor < netTargetMinor) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return result;
}
