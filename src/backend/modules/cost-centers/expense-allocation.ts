/**
 * SAF, VERİTABANINDAN BAĞIMSIZ hesaplama — `payroll-calculator.ts` ile aynı
 * ruhta (test edilebilir, HTTP/Prisma/React bilmez).
 *
 * Bir `AllocationKey` tanımlı olan KAYNAK gider merkezine ait `ExpenseEntry`
 * tutarını, üye gider merkezlerine SABİT % ağırlıkla dağıtır. Bu dağılım
 * SADECE raporlama/iç yükleme (cross-charge) amaçlıdır: `BudgetLine`'da
 * gider merkezi ekseni YOKTUR (sadece scenarioId/categoryId/month), bu
 * yüzden dağılım booked kategori/ay toplamını ASLA değiştirmez — sadece
 * "bu tutarı kim taşıyor" sorusuna raporlama için cevap verir.
 *
 * Kuruş (integer minor unit) bazında çalışır — en büyük kalan (largest
 * remainder) yuvarlama geçişi, dağıtılan parçaların TOPLAMININ orijinal
 * tutara TAM eşit kalmasını garantiler (bkz. money.ts'teki disiplin).
 */

export interface AllocationEntryInput {
  costCenterId: string;
  categoryId: string;
  month: number;
  amountMinor: number;
}

export interface AllocationKeyInput {
  sourceCostCenterId: string;
  members: { costCenterId: string; weightPercent: number }[];
}

export interface AllocationReportRowResult {
  costCenterId: string;
  categoryId: string;
  month: number;
  amountMinor: number;
}

/**
 * `totalMinor`'ı `weights` (yüzde, 0-100) oranında kuruş bazında böler.
 * En büyük kalan yöntemi: her payı aşağı yuvarlar, kalan kuruşları en büyük
 * ondalık artığı olan üyelere birer birer dağıtır — parçaların toplamı HER
 * ZAMAN `totalMinor`'a tam eşit kalır.
 */
function splitByWeight(totalMinor: number, weights: number[]): number[] {
  const rawShares = weights.map((w) => (totalMinor * w) / 100);
  const floored = rawShares.map((s) => Math.floor(s));
  let remainder = totalMinor - floored.reduce((sum, v) => sum + v, 0);

  const remainders = rawShares.map((s, i) => ({ index: i, frac: s - floored[i] }));
  remainders.sort((a, b) => b.frac - a.frac);

  const result = [...floored];
  for (const { index } of remainders) {
    if (remainder <= 0) break;
    result[index] += 1;
    remainder -= 1;
  }
  return result;
}

export function computeAllocationReport(
  entries: AllocationEntryInput[],
  keys: AllocationKeyInput[],
): AllocationReportRowResult[] {
  const keyBySourceCostCenter = new Map(keys.map((k) => [k.sourceCostCenterId, k]));
  const totalsByCell = new Map<string, AllocationReportRowResult>();

  function addToCell(
    costCenterId: string,
    categoryId: string,
    month: number,
    amountMinor: number,
  ) {
    const key = `${costCenterId}:${categoryId}:${month}`;
    const existing = totalsByCell.get(key);
    if (existing) {
      existing.amountMinor += amountMinor;
    } else {
      totalsByCell.set(key, { costCenterId, categoryId, month, amountMinor });
    }
  }

  for (const entry of entries) {
    const key = keyBySourceCostCenter.get(entry.costCenterId);

    if (!key || key.members.length === 0) {
      // Bu gider merkezi için tanımlı bir tahsis anahtarı yok -> kendi
      // merkezine değişmeden atfedilir.
      addToCell(entry.costCenterId, entry.categoryId, entry.month, entry.amountMinor);
      continue;
    }

    const shares = splitByWeight(
      entry.amountMinor,
      key.members.map((m) => m.weightPercent),
    );

    key.members.forEach((member, i) => {
      addToCell(member.costCenterId, entry.categoryId, entry.month, shares[i]);
    });
  }

  return [...totalsByCell.values()].sort(
    (a, b) => a.month - b.month || a.costCenterId.localeCompare(b.costCenterId),
  );
}
