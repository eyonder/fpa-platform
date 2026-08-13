/**
 * SAF, VERİTABANINDAN BAĞIMSIZ hesaplama — `payroll-calculator.ts` ile aynı
 * ruhta (test edilebilir, HTTP/Prisma/React bilmez).
 *
 * VUK kıst amortisman kuralı: bir varlığın ilk (kısmi) yılında, elde tutulan
 * ay sayısı oranında amortisman ayrılır; ilk yılda ayrılamayan kalan tutar
 * KAYBOLMAZ — faydalı ömrün SONUNA (bir takvim yılı daha uzatarak) ertelenir.
 *
 * Bu tabloda HER kategori için `annualRate * usefulLifeYears = 1.0`
 * (ör. %20 * 5 yıl = 1). Bu yüzden en basit ve doğru uygulama, satın alma
 * AYINDAN başlayarak (takvim yılı hizalaması ARANMADAN) tam olarak
 * `usefulLifeYears * 12` ardışık AYLIK tutar dizmektir — kullanıcının verdiği
 * örneği (Ekim'de alınan %20/5 yıllık bir taşıt: 1. yılda 3 ay, 2-5. yıllarda
 * 12'şer ay, kalan 9 ay 6. yıla taşar = 60 ay) özel bir "son yıl" dalı
 * YAZMADAN kendiliğinden üretir.
 *
 * Yuvarlama: her ay nominal tutarı alır, SON ay kalan artığı üstlenir (plug) —
 * böylece toplam HER ZAMAN baseValueMinor'a TAM eşittir. Bu,
 * `expense-allocation.ts`'teki largest-remainder dağıtımından FARKLI bir
 * disiplindir (kalan TEK bir aya yığılır, birçok aya dağıtılmaz); mali
 * etkisi önemsizdir (60 aylık bir programda birkaç kuruş) ve gerçek
 * amortisman tablolarındaki alışılmış "son taksit = kalan bakiye" geleneğiyle
 * örtüşür — bilinçli bir tercih, largest-remainder'a GEÇİLMEDİ.
 */

export interface DepreciationScheduleInput {
  baseValueMinor: number;
  /** Ondalık oran, ör. 0.20 (%20). */
  annualRate: number;
  usefulLifeYears: number;
  acquisitionYear: number;
  /** 1-12 */
  acquisitionMonth: number;
}

export interface DepreciationMonthEntry {
  year: number;
  /** 1-12 */
  month: number;
  /** 1'den başlayan sıra no — programın toplam kaç ay sürdüğünü doğrulamak için. */
  sequenceNumber: number;
  amountMinor: number;
}

export function generateDepreciationSchedule(
  input: DepreciationScheduleInput,
): DepreciationMonthEntry[] {
  const {
    baseValueMinor,
    annualRate,
    usefulLifeYears,
    acquisitionYear,
    acquisitionMonth,
  } = input;

  const totalMonths = usefulLifeYears * 12;
  const nominalMinor = Math.round((baseValueMinor * annualRate) / 12);

  const entries: DepreciationMonthEntry[] = [];
  for (let i = 0; i < totalMonths; i++) {
    const offset = acquisitionMonth - 1 + i;
    const month = (offset % 12) + 1;
    const year = acquisitionYear + Math.floor(offset / 12);
    const isLast = i === totalMonths - 1;
    const amountMinor = isLast
      ? baseValueMinor - nominalMinor * (totalMonths - 1)
      : nominalMinor;

    entries.push({ year, month, sequenceNumber: i + 1, amountMinor });
  }

  return entries;
}
