import { foldTokens } from "@/backend/core/text";
import { toMinorUnits } from "@/shared/lib/money";
import type {
  CashFlowDirection,
  MatchCandidate,
  MatchConfidence,
} from "@/shared/types";

import { diffDays } from "./treasury.dates";

/**
 * SAF EŞLEŞTİRME MOTORU — `thp-mapping.ts`/`import-mapping.ts` ile AYNI
 * disiplin: HTTP'yi, Prisma'yı, React'i BİLMEZ. Girdi olarak düz nesneler
 * alır, düz nesneler döner; veritabanı olmadan test edilebilir.
 *
 * TEMEL KURAL: bu modül ÖNERİR, ASLA ONAYLAMAZ. Hiçbir güven seviyesinde
 * otomatik eşleştirme YOKTUR — hatalı bir mutabakat sessizdir ve birikir
 * (yanlış nötrlenen bir tahmin projeksiyondan düşer, kimse fark etmez).
 * `treasury-import.service.ts`teki öner→gözden geçir→onayla disiplininin
 * aynısı (bkz. plan §3.3).
 */

export interface MatchableEvent {
  id: string;
  /** YYYY-MM-DD */
  dueDate: string;
  direction: CashFlowDirection;
  amount: number;
  categoryId: string;
  counterparty: string | null;
  description: string | null;
}

export interface MatchableTransaction {
  id: string;
  /** YYYY-MM-DD */
  valueDate: string;
  direction: CashFlowDirection;
  amount: number;
  description: string;
  counterparty: string | null;
}

export interface MatcherOptions {
  dateWindowDays: number;
  amountTolerancePct: number;
}

export const DEFAULT_DATE_WINDOW_DAYS = 7;
export const DEFAULT_AMOUNT_TOLERANCE_PCT = 0.5;

/** Yüzde toleransı KÜÇÜK tutarlarda anlamsız kalır (100 TL'nin %0.5'i 50
 * kuruş); bu taban her zaman geçerlidir. */
const MIN_ABSOLUTE_TOLERANCE = 1;

/** İlk iki aday bu farktan yakınsa "en iyi" aday güvenilir sayılamaz. */
const AMBIGUITY_MARGIN = 5;

const MAX_CANDIDATES = 3;

const WEIGHT_AMOUNT = 0.5;
const WEIGHT_DATE = 0.3;
const WEIGHT_COUNTERPARTY = 0.2;

/** İki metnin ortak jeton oranı (Jaccard). Taraflardan biri boşsa 0 —
 * "kanıt yok" demek "eşleşiyor" demek DEĞİLDİR. */
export function counterpartySimilarity(left: string, right: string): number {
  const a = new Set(foldTokens(left));
  const b = new Set(foldTokens(right));
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : (intersection / union) * 100;
}

export interface ScoredCandidate {
  event: MatchableEvent;
  score: number;
  amountScore: number;
  dateScore: number;
  counterpartyScore: number;
  amountDeltaMinor: number;
  dayDelta: number;
  reasons: string[];
}

/**
 * Tek bir (hareket, tahmin) çifti için puan üretir. HARD FİLTRELER burada
 * `null` döndürür — yön ASLA çaprazlanmaz (bir tahsilat bir ödemeyle
 * eşleşemez), tarih penceresi ve tutar toleransı da aşılamaz. Geri kalan
 * her şey PUANLAMADIR (bkz. plan §3.3).
 */
export function scoreCandidate(
  transaction: MatchableTransaction,
  event: MatchableEvent,
  options: MatcherOptions,
): ScoredCandidate | null {
  if (transaction.direction !== event.direction) return null;

  const dayDelta = diffDays(event.dueDate, transaction.valueDate);
  if (Math.abs(dayDelta) > options.dateWindowDays) return null;

  // Tutar karşılaştırmaları KURUŞ (integer) üzerinden — float eşitliği
  // ("tam tutar" testi) aksi halde 0.1+0.2 tuzağına düşer.
  const txnMinor = toMinorUnits(transaction.amount);
  const eventMinor = toMinorUnits(event.amount);
  const amountDeltaMinor = txnMinor - eventMinor;

  const toleranceMinor = Math.max(
    toMinorUnits(MIN_ABSOLUTE_TOLERANCE),
    Math.round((Math.abs(eventMinor) * options.amountTolerancePct) / 100),
  );
  if (Math.abs(amountDeltaMinor) > toleranceMinor) return null;

  const reasons: string[] = [];

  const amountScore =
    amountDeltaMinor === 0
      ? 100
      : 100 * (1 - Math.abs(amountDeltaMinor) / toleranceMinor);
  if (amountDeltaMinor === 0) reasons.push("Tutar birebir aynı");
  else reasons.push(`Tutar farkı ${(amountDeltaMinor / 100).toFixed(2)}`);

  const dateScore =
    options.dateWindowDays === 0
      ? 100
      : 100 * (1 - Math.abs(dayDelta) / options.dateWindowDays);
  if (dayDelta === 0) reasons.push("Vade ile valör aynı gün");
  else reasons.push(`${Math.abs(dayDelta)} gün ${dayDelta > 0 ? "geç" : "erken"}`);

  const counterpartyScore = counterpartySimilarity(
    `${transaction.counterparty ?? ""} ${transaction.description}`,
    `${event.counterparty ?? ""} ${event.description ?? ""}`,
  );
  if (counterpartyScore >= 50) reasons.push("Karşı taraf metni benzeşiyor");
  else if (counterpartyScore === 0) reasons.push("Karşı taraf metni eşleşmedi");

  const score =
    WEIGHT_AMOUNT * amountScore +
    WEIGHT_DATE * dateScore +
    WEIGHT_COUNTERPARTY * counterpartyScore;

  return {
    event,
    score: Math.round(score * 10) / 10,
    amountScore,
    dateScore,
    counterpartyScore,
    amountDeltaMinor,
    dayDelta,
    reasons,
  };
}

function bandOf(candidate: ScoredCandidate): MatchConfidence {
  if (
    candidate.amountDeltaMinor === 0 &&
    Math.abs(candidate.dayDelta) <= 3 &&
    candidate.counterpartyScore >= 50
  ) {
    return "HIGH";
  }
  return candidate.score >= 70 ? "MEDIUM" : "LOW";
}

/**
 * Tek bir hareket için en iyi (en fazla 3) adayı üretir.
 *
 * BELİRSİZLİK KORUMASI: en yüksek puana `AMBIGUITY_MARGIN` kadar yakın BİRDEN
 * FAZLA aday varsa, o adayların HEPSİ LOW'a düşürülür. Berabere biten bir
 * eşleşme ASLA güvenli görünmemelidir — kullanıcı hangisinin doğru olduğuna
 * bakmadan onaylarsa yanlış tahmini nötrlemiş olur.
 *
 * SADECE BİRİNCİYİ düşürmek YETMEZ (canlı doğrulamada bizzat görüldü):
 * berabere kalan ikinci aday MEDIUM kalınca ekranda birinciden DAHA GÜVENLİ
 * görünüyordu — koruma tam tersine çalışmış oluyordu. Berabereliğin her iki
 * tarafı da eşit derecede şüphelidir.
 */
export function suggestForTransaction(
  transaction: MatchableTransaction,
  events: MatchableEvent[],
  options: MatcherOptions,
): MatchCandidate[] {
  const scored = events
    .map((event) => scoreCandidate(transaction, event, options))
    .filter((c): c is ScoredCandidate => c !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);

  const tiedCount =
    scored.length === 0
      ? 0
      : scored.filter((c) => scored[0].score - c.score < AMBIGUITY_MARGIN).length;
  const ambiguous = tiedCount >= 2;

  return scored.map((candidate) => {
    const downgraded =
      ambiguous && scored[0].score - candidate.score < AMBIGUITY_MARGIN;
    return {
      eventId: candidate.event.id,
      score: candidate.score,
      confidence: downgraded ? "LOW" : bandOf(candidate),
      amountDelta: candidate.amountDeltaMinor / 100,
      dayDelta: candidate.dayDelta,
      reasons: downgraded
        ? [...candidate.reasons, "Birden fazla benzer aday"]
        : candidate.reasons,
      event: {
        dueDate: candidate.event.dueDate,
        direction: candidate.event.direction,
        amount: candidate.event.amount,
        categoryId: candidate.event.categoryId,
        counterparty: candidate.event.counterparty,
        description: candidate.event.description,
      },
    };
  });
}

/**
 * Tüm eşleşmemiş hareketler için öneri üretir.
 *
 * Bir tahmin BİRDEN FAZLA hareketin aday listesinde çıkabilir — bu KASITLI:
 * burada kimse rezerve edilmez, seçimi kullanıcı yapar. Çakışma (aynı
 * tahmini iki kez onaylama) `confirm` adımında 409 ile ve nihayetinde
 * `matchedEventId @unique` ile engellenir.
 */
export function suggestMatches(
  transactions: MatchableTransaction[],
  events: MatchableEvent[],
  options: MatcherOptions,
): Array<{ bankTransactionId: string; candidates: MatchCandidate[] }> {
  return transactions.map((transaction) => ({
    bankTransactionId: transaction.id,
    candidates: suggestForTransaction(transaction, events, options),
  }));
}
