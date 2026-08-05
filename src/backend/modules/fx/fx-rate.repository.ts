/**
 * VERİ ERİŞİM KATMANI (Repository).
 *
 * Şu an bellekte sahte, GEÇMİŞE DÖNÜK bir kur tablosu döner — gerçek bir
 * TCMB/ECB/serbest piyasa besleme günlük bir job ile bu tabloyu (ya da
 * Prisma'daki karşılığını) doldurur; servis/route katmanı değişmez.
 * Kasıtlı olarak sadece USD->TRY ve EUR->TRY satırları var (EUR->USD YOK):
 * fx-rate.service.ts'teki çapraz kur (cross-rate) mantığını gerçek bir
 * senaryoda (ortak pivot para birimi üzerinden) test etmek için.
 */

export interface FxRateRecord {
  /** YYYY-MM-DD, bu kurun yürürlüğe girdiği gün. */
  date: string;
  base: string;
  quote: string;
  /** 1 base = rate quote. */
  rate: number;
}

const RATES: FxRateRecord[] = [
  { date: "2026-08-01", base: "USD", quote: "TRY", rate: 34.1 },
  { date: "2026-08-05", base: "USD", quote: "TRY", rate: 34.25 },
  { date: "2026-08-06", base: "USD", quote: "TRY", rate: 34.3 },
  { date: "2026-08-01", base: "EUR", quote: "TRY", rate: 37.05 },
  { date: "2026-08-05", base: "EUR", quote: "TRY", rate: 37.2 },
  { date: "2026-08-06", base: "EUR", quote: "TRY", rate: 37.28 },
];

export const fxRateRepository = {
  /** base/quote çifti için, asOfDate'te ya da ONDAN ÖNCEKİ en güncel kur. */
  async findLatestOnOrBefore(
    base: string,
    quote: string,
    asOfDate: string,
  ): Promise<FxRateRecord | null> {
    const candidates = RATES.filter(
      (r) => r.base === base && r.quote === quote && r.date <= asOfDate,
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((latest, r) => (r.date > latest.date ? r : latest));
  },
};
