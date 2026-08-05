import { AppError } from "@/backend/core/errors";
import { roundMoney, roundRate } from "@/shared/lib/money";

import { fxRateRepository } from "./fx-rate.repository";

/**
 * İŞ MANTIĞI KATMANI (Service).
 *
 * Kural: Bu dosya HTTP'yi, Next.js'i veya React'i bilmez. Sadece iş kurallarını bilir.
 *
 * Kur tablosunda her para birimi çifti doğrudan yoktur (ör. EUR->USD).
 * Bu yüzden: önce doğrudan kur, sonra TERS kur (1/rate), sonra ortak bir
 * pivot para birimi (TRY) üzerinden ÇAPRAZ KUR denenir. Hiçbiri yoksa
 * SESSİZCE 1 varsaymak (ör. "kur yok, aynıymış gibi davran") finansal
 * raporda ciddi bir hataya yol açar -> açıkça hata fırlatılır.
 */

const PIVOT_CURRENCY = "TRY";

export interface ConversionResult {
  rate: number;
  convertedAmount: number;
}

async function findDirectOrInverseRate(
  from: string,
  to: string,
  asOfDate: string,
): Promise<number | null> {
  const direct = await fxRateRepository.findLatestOnOrBefore(from, to, asOfDate);
  if (direct) return direct.rate;

  const inverse = await fxRateRepository.findLatestOnOrBefore(to, from, asOfDate);
  if (inverse) return roundRate(1 / inverse.rate);

  return null;
}

export const fxRateService = {
  /** amount (fromCurrency) -> toCurrency, asOfDate'te (veya öncesinde) geçerli en güncel kurla. */
  async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    asOfDate: string,
  ): Promise<ConversionResult> {
    if (fromCurrency === toCurrency) {
      return { rate: 1, convertedAmount: roundMoney(amount) };
    }

    const direct = await findDirectOrInverseRate(fromCurrency, toCurrency, asOfDate);
    if (direct !== null) {
      return { rate: direct, convertedAmount: roundMoney(amount * direct) };
    }

    // Ortak pivot (TRY) üzerinden çapraz kur: EUR->TRY ve TRY->USD biliniyorsa
    // EUR->USD = (EUR->TRY) * (TRY->USD).
    if (fromCurrency !== PIVOT_CURRENCY && toCurrency !== PIVOT_CURRENCY) {
      const toPivot = await findDirectOrInverseRate(
        fromCurrency,
        PIVOT_CURRENCY,
        asOfDate,
      );
      const pivotToTarget = await findDirectOrInverseRate(
        PIVOT_CURRENCY,
        toCurrency,
        asOfDate,
      );

      if (toPivot !== null && pivotToTarget !== null) {
        const crossRate = roundRate(toPivot * pivotToTarget);
        return { rate: crossRate, convertedAmount: roundMoney(amount * crossRate) };
      }
    }

    throw new AppError(
      "FX_RATE_NOT_FOUND",
      `${fromCurrency} → ${toCurrency} için ${asOfDate} tarihinde (veya öncesinde) kur bulunamadı.`,
      422,
    );
  },
};
