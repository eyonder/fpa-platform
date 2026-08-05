/**
 * Finansal tutar aritmetiği için ortak yardımcılar.
 *
 * UFRS raporlaması, tutarların hesap zinciri boyunca KAYMAMASINI gerektirir.
 * IEEE-754 float toplama/çıkarma bazen 2 ondalığın ötesinde sapma üretir
 * (ör. 0.1 + 0.2 !== 0.3). Bunu önlemek için: para ile ilgili her ara işlem
 * kuruş (integer minor unit) bazında yapılır, sadece girdi/çıktıda majör
 * birime (TRY, USD, ...) çevrilir. Bu dosya frontend ve backend'in ORTAK
 * kullandığı saf matematik — React ya da veritabanı kodu bilmez.
 */

const MINOR_UNITS_PER_MAJOR = 100;

export function toMinorUnits(amount: number): number {
  return Math.round(amount * MINOR_UNITS_PER_MAJOR);
}

export function fromMinorUnits(minorUnits: number): number {
  return minorUnits / MINOR_UNITS_PER_MAJOR;
}

/** Bir tutarı en yakın kuruşa yuvarlar (para birimi hassasiyeti: 2 ondalık). */
export function roundMoney(amount: number): number {
  return fromMinorUnits(toMinorUnits(amount));
}

/** Yüzde değerlerini 2 ondalığa yuvarlar (raporlama tutarlılığı için). */
export function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Döviz kurlarını 6 ondalığa yuvarlar (standart FX kotasyon hassasiyeti). */
export function roundRate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
