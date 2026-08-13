/**
 * SAF, VERİTABANINDAN BAĞIMSIZ hesaplama — `payroll-calculator.ts`teki
 * `netToGross`in ikili arama (bisection) disipliniyle AYNI: NPV(oran)=0
 * kapalı formülle çözülemez (nakit akışları keyfi olabilir), bu yüzden
 * `computeNpvMinor` üzerinde ikili arama ile çözülür.
 */

export interface CashFlowMinor {
  /** Yıl 0 = ilk yatırım (negatif). */
  year: number;
  amountMinor: number;
}

export function computeNpvMinor(
  cashFlows: CashFlowMinor[],
  annualDiscountRate: number,
): number {
  return cashFlows.reduce(
    (sum, cf) => sum + cf.amountMinor / Math.pow(1 + annualDiscountRate, cf.year),
    0,
  );
}

/**
 * IRR: NPV(oran) = 0'ı çözer. `[-0.99, 10]` (%-99 ile %1000 arası) aralığında
 * kök ARANIR — bu aralığın uçlarında NPV işaret DEĞİŞTİRMİYORSA (ör. tüm
 * nakit akışları aynı işaretliyse, kök yoktur) `null` döner; `netToGross`teki
 * "brüt arttıkça net monoton artar, bu yüzden ikili arama güvenlidir"
 * varsayımının burdaki karşılığı: işaret değişimi varsa TEK bir kök olduğu
 * varsayılır (klasik/konvansiyonel nakit akışı serisi — tek bir başlangıç
 * çıkışı, ardından girişler).
 */
export function computeIrr(cashFlows: CashFlowMinor[]): number | null {
  let low = -0.99;
  let high = 10;
  let npvAtLow = computeNpvMinor(cashFlows, low);
  const npvAtHigh = computeNpvMinor(cashFlows, high);

  if (npvAtLow === 0) return low;
  if (npvAtHigh === 0) return high;
  if (Math.sign(npvAtLow) === Math.sign(npvAtHigh)) return null; // aralıkta kök yok

  let mid = (low + high) / 2;
  let npvAtMid = computeNpvMinor(cashFlows, mid);

  for (let i = 0; i < 100 && Math.abs(npvAtMid) > 1; i++) {
    if (Math.sign(npvAtMid) === Math.sign(npvAtLow)) {
      low = mid;
      npvAtLow = npvAtMid;
    } else {
      high = mid;
    }
    mid = (low + high) / 2;
    npvAtMid = computeNpvMinor(cashFlows, mid);
  }

  return mid;
}
