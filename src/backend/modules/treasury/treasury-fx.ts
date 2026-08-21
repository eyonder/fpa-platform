import { fxRateService } from "@/backend/modules/fx/fx-rate.service";
import { toMinorUnits } from "@/shared/lib/money";
import type { BankBalanceSnapshot, BankTransactionEntry } from "@/shared/types";

/**
 * ÇOKLU PARA BİRİMİ -> RAPORLAMA PARA BİRİMİ çevrimi (Hazine).
 *
 * `BankAccount` geldiğinde Hazine tek para birimi varsayımını kaybetti: bir
 * tenant'ın TL/USD/EUR hesapları olabilir, ama projeksiyon TEK bir eğri çizer.
 * Çevrim SAKLANMAZ, her istekte `FxRate`ten yapılır — kur değişince geçmişe
 * dönük veri düzeltmesi gerekmesin diye (bkz. prisma/schema.prisma'daki
 * BankAccount notu).
 *
 * KUR BULUNAMAZSA NE OLUR: satır SESSİZCE ATLANMAZ ve gizlice yanlış bir
 * bakiye üretilmez — satır toplama katılmaz AMA hangi para birimi/tarih için
 * kur eksik olduğunu SÖYLEYEN bir uyarı üretilir. Modülün her yerindeki aynı
 * disiplin: görünür uyarı > sessiz yanlışlık (bkz. findPossibleDuplicates).
 */

export interface ConvertedAccountBalance {
  bankAccountId: string;
  bankName: string;
  currency: string;
  /** Hesabın kendi para biriminde. */
  balance: number;
  /** Raporlama para biriminde. */
  convertedBalance: number;
  fxRate: number;
}

export interface FxConversionResult<T> {
  items: T[];
  totalMinor: number;
  warnings: string[];
}

/** Çıpa günündeki hesap fotoğraflarını raporlama para birimine çevirir. */
export async function convertAccountBalances(
  snapshots: BankBalanceSnapshot[],
  reportingCurrency: string,
  asOfDate: string,
): Promise<FxConversionResult<ConvertedAccountBalance>> {
  const items: ConvertedAccountBalance[] = [];
  const warnings: string[] = [];
  let totalMinor = 0;

  for (const snapshot of snapshots) {
    try {
      const { rate, convertedAmount } = await fxRateService.convert(
        snapshot.balance,
        snapshot.currency,
        reportingCurrency,
        asOfDate,
      );
      items.push({
        bankAccountId: snapshot.bankAccountId,
        bankName: snapshot.bankName,
        currency: snapshot.currency,
        balance: snapshot.balance,
        convertedBalance: convertedAmount,
        fxRate: rate,
      });
      totalMinor += toMinorUnits(convertedAmount);
    } catch {
      warnings.push(
        `${snapshot.bankName} (${snapshot.currency}) hesabı açılış bakiyesine ` +
          `DAHİL EDİLMEDİ: ${asOfDate} tarihinde ${snapshot.currency} → ` +
          `${reportingCurrency} kuru yok. Kuru girin, bakiye ${snapshot.balance.toFixed(2)} ` +
          `${snapshot.currency} kadar EKSİK görünüyor.`,
      );
    }
  }

  return { items, totalMinor, warnings };
}

/**
 * Banka hareketlerini raporlama para birimine çevirip İŞARETLİ kuruş olarak
 * güne göre toplar. Her hareket KENDİ valör tarihindeki kurla çevrilir —
 * hepsini tek bir güne ait kurla çevirmek, aylar süren bir pencerede kur
 * hareketini görmezden gelmek olurdu.
 */
export async function convertTransactionsByDay(
  transactions: BankTransactionEntry[],
  reportingCurrency: string,
): Promise<{ byDay: Map<string, number>; warnings: string[] }> {
  const byDay = new Map<string, number>();
  const warnings: string[] = [];
  const missing = new Set<string>();

  for (const txn of transactions) {
    let minor: number;
    if (txn.currency === reportingCurrency) {
      minor = toMinorUnits(txn.amount);
    } else {
      try {
        const { convertedAmount } = await fxRateService.convert(
          txn.amount,
          txn.currency,
          reportingCurrency,
          txn.valueDate,
        );
        minor = toMinorUnits(convertedAmount);
      } catch {
        missing.add(`${txn.currency} (${txn.valueDate})`);
        continue;
      }
    }
    const signed = txn.direction === "INFLOW" ? minor : -minor;
    byDay.set(txn.valueDate, (byDay.get(txn.valueDate) ?? 0) + signed);
  }

  if (missing.size > 0) {
    warnings.push(
      `Kur bulunamadığı için ${missing.size} banka hareketi grubu projeksiyona ` +
        `DAHİL EDİLMEDİ: ${[...missing].join(", ")}. Eksik kurları girmeden ` +
        `bakiye eğrisi eksiktir.`,
    );
  }

  return { byDay, warnings };
}
