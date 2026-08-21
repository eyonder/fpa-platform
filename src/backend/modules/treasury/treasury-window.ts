import { addDays, todayIso } from "./treasury.dates";

/**
 * SAF PENCERE & AÇILIŞ BAKİYESİ ARİTMETİĞİ.
 *
 * `treasury-balance.service.ts` (Faz 4.3, mutabakat ekranı) ve
 * `treasury-projection.service.ts` (Faz 4.4, /hazine) AYNI açılış bakiyesi
 * formülünü kullanmak ZORUNDA — iki ekranın farklı açılış göstermesi
 * kullanıcı için açıklanamaz bir çelişki olurdu. Formülü iki yerde
 * kopyalamak yerine tek kaynağa alındı; kopyalanan bir formül tam olarak
 * böyle sessizce ayrışır.
 */

export const DEFAULT_HORIZON_DAYS = 90;

export interface TreasuryWindow {
  /** Pencerenin dayandığı gün — bu günün KENDİSİ açılış bakiyesine dahildir. */
  startDate: string;
  /** İlk kova günü (startDate + 1). */
  firstDay: string;
  /** Son kova günü (startDate + horizonDays). */
  endDate: string;
  horizonDays: number;
}

export function resolveWindow(
  startDate?: string,
  horizonDays?: number,
): TreasuryWindow {
  const start = startDate ?? todayIso();
  const horizon = horizonDays ?? DEFAULT_HORIZON_DAYS;
  return {
    startDate: start,
    firstDay: addDays(start, 1),
    endDate: addDays(start, horizon),
    horizonDays: horizon,
  };
}

/** Çıpa artık TEK bir hesabın bakiyesi değil, o günün TÜM hesaplarının
 * RAPORLAMA PARA BİRİMİNE çevrilmiş toplamıdır (bkz. bank.service.ts
 * #resolveAnchor) — bu yüzden burada kuruş cinsinden hazır gelir. */
export interface OpeningAnchor {
  asOfDate: string;
  totalMinor: number;
}

/**
 * Açılış bakiyesi = çıpa + (çıpa < valör <= startDate) banka hareketleri.
 *
 * Çıpadan ÖNCEKİ hareketler BİLEREK sayılmaz: elle girilen top bakiye kendi
 * gününe kadar olan her şeyi ZATEN içerir, onları da eklemek ÇİFT SAYMAKTIR.
 * Çıpa yoksa 0 kabul edilir (ve çağıran bir uyarı üretir).
 *
 * `byDay` RAPORLAMA PARA BİRİMİNE ÇEVRİLMİŞ, işaretli kuruş toplamlarıdır
 * (bkz. treasury-fx.ts#convertTransactionsByDay) — çoklu para birimli
 * hesaplar geldiğinden beri çevrim bu fonksiyonun DIŞINDA yapılır.
 */
export function computeOpeningBalanceMinor(
  anchor: OpeningAnchor | null,
  byDay: Map<string, number>,
  startDate: string,
): number {
  let minor = anchor ? anchor.totalMinor : 0;
  for (const [date, signedMinor] of byDay) {
    if (anchor && date <= anchor.asOfDate) continue;
    if (date > startDate) continue;
    minor += signedMinor;
  }
  return minor;
}
