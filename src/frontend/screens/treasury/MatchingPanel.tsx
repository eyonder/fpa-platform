"use client";

import { useCallback, useState } from "react";

import { Badge } from "@/frontend/components/ui/Badge";
import { Card } from "@/frontend/components/ui/Card";
import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { formatAmount } from "@/frontend/lib/format";
import type {
  BudgetCategory,
  MatchConfidence,
  ReconciliationSuggestions,
} from "@/shared/types";

const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const SECONDARY_BUTTON =
  "rounded-md border border-rule px-4 py-2 text-sm transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const SMALL_SECONDARY_BUTTON =
  "rounded-md border border-rule px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";

const CONFIDENCE_LABEL: Record<MatchConfidence, string> = {
  HIGH: "Yüksek",
  MEDIUM: "Orta",
  LOW: "Düşük",
};

const CONFIDENCE_TONE: Record<MatchConfidence, "ledger" | "neutral" | "brick"> = {
  HIGH: "ledger",
  MEDIUM: "neutral",
  LOW: "brick",
};

/**
 * Mutabakat paneli — ÖNER, GÖZDEN GEÇİR, ONAYLA.
 *
 * Hiçbir aday OTOMATİK seçili GELMEZ, "Yüksek" güvenli olanlar bile
 * (bkz. reconciliation.matcher.ts dosya başı notu): hatalı bir nötrleme
 * sessizdir ve projeksiyonu kalıcı olarak bozar. Kullanıcı her satır için
 * bilinçli olarak bir aday seçer.
 *
 * Rol filtresi UX içindir — asıl sınır backend'de
 * `treasury-reconciliation:run` iznidir (bkz. authorize.ts).
 */
export function MatchingPanel({
  scenarioId,
  categories,
  onChanged,
}: {
  scenarioId: string;
  categories: BudgetCategory[];
  onChanged: () => void;
}) {
  const [dateWindowDays, setDateWindowDays] = useState(7);
  const [amountTolerancePct, setAmountTolerancePct] = useState(0.5);

  const [suggestions, setSuggestions] = useState<ReconciliationSuggestions | null>(
    null,
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** bankTransactionId -> seçilen cashFlowEventId */
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  /** "Deftere ekle" formu açık olan hareket. */
  const [promoteFor, setPromoteFor] = useState<string | null>(null);
  const [promoteCategoryId, setPromoteCategoryId] = useState("");

  /** Önerileri (yeniden) hesaplar. `notice`'i BİLEREK TEMİZLEMEZ: onay ve
   * "deftere ekle" işlemleri başarıdan HEMEN SONRA listeyi tazelemek için
   * bunu çağırır — temizleseydi başarı mesajı hiç görünmeden kaybolurdu
   * (canlı doğrulamada bizzat böyle oldu). Kullanıcı butona kendi bastığında
   * mesajı onClick temizler. */
  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setSelection({});
    try {
      const result = await apiClient.post<ReconciliationSuggestions>(
        "/treasury/reconciliation/suggestions",
        { scenarioId, dateWindowDays, amountTolerancePct },
      );
      setSuggestions(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Öneriler hesaplanamadı.");
    } finally {
      setRunning(false);
    }
  }, [scenarioId, dateWindowDays, amountTolerancePct]);

  const confirmSelected = useCallback(async () => {
    const pairs = Object.entries(selection).map(
      ([bankTransactionId, cashFlowEventId]) => ({
        bankTransactionId,
        cashFlowEventId,
      }),
    );
    if (pairs.length === 0) return;

    setConfirming(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiClient.post<{ confirmed: number }>(
        "/treasury/reconciliation/confirm",
        { pairs },
      );
      setNotice(`${result.confirmed} eşleşme onaylandı ve tahminler nötrlendi.`);
      setSelection({});
      onChanged();
      await run();
    } catch (err) {
      // HEPSİ YA DA HİÇBİRİ — hata durumunda hiçbir çift yazılmamıştır,
      // seçim bilerek KORUNUR ki kullanıcı düzeltip tekrar deneyebilsin.
      setError(err instanceof ApiError ? err.message : "Eşleşmeler onaylanamadı.");
    } finally {
      setConfirming(false);
    }
  }, [selection, onChanged, run]);

  const promote = useCallback(
    async (bankTransactionId: string) => {
      if (!promoteCategoryId) return;
      setError(null);
      setNotice(null);
      try {
        await apiClient.post("/treasury/reconciliation/promote", {
          bankTransactionId,
          scenarioId,
          categoryId: promoteCategoryId,
        });
        setNotice("Hareket deftere eklendi (nötrlenmiş nakit olayı oluşturuldu).");
        setPromoteFor(null);
        setPromoteCategoryId("");
        onChanged();
        await run();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Deftere eklenemedi.");
      }
    },
    [promoteCategoryId, scenarioId, onChanged, run],
  );

  const selectedCount = Object.keys(selection).length;

  return (
    <Card
      title="Mutabakat"
      hint={
        suggestions
          ? `${suggestions.suggestions.length} eşleşmemiş hareket`
          : "önerileri hesaplayın"
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Eşleşmemiş banka hareketleri için tahmin adayları önerilir. Hiçbir aday
          otomatik onaylanmaz — onayladığınız tahmin <em>nötrlenir</em> ve projeksiyonun
          tahmin toplamından düşer.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs text-muted">Gün penceresi</span>
            <input
              type="number"
              min={0}
              max={30}
              value={dateWindowDays}
              onChange={(e) => setDateWindowDays(Number(e.target.value))}
              className={`${INPUT_CLASS} w-28`}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Tutar toleransı (%)</span>
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={amountTolerancePct}
              onChange={(e) => setAmountTolerancePct(Number(e.target.value))}
              className={`${INPUT_CLASS} w-32`}
            />
          </label>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            disabled={running || !scenarioId}
            onClick={() => {
              setNotice(null);
              void run();
            }}
          >
            {running ? "Hesaplanıyor…" : "Önerileri Hesapla"}
          </button>
        </div>

        {error ? <p className="text-sm text-brick">{error}</p> : null}
        {notice ? <p className="text-sm text-ledger">{notice}</p> : null}

        {suggestions ? (
          suggestions.suggestions.length === 0 ? (
            <p className="text-sm text-muted">
              Eşleşmemiş banka hareketi yok — her şey mutabık.
            </p>
          ) : (
            <div className="space-y-3">
              {suggestions.suggestions.map((suggestion) => (
                <div
                  key={suggestion.bankTransactionId}
                  className="rounded-md border border-rule px-4 py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <span className="tabular text-sm font-medium">
                        {suggestion.transaction.valueDate}
                      </span>
                      <span className="ml-2 text-sm">
                        {suggestion.transaction.description}
                      </span>
                      {suggestion.transaction.counterparty ? (
                        <span className="ml-2 text-xs text-muted">
                          {suggestion.transaction.counterparty}
                        </span>
                      ) : null}
                    </div>
                    <span
                      className={`tabular text-sm font-medium ${
                        suggestion.transaction.direction === "INFLOW"
                          ? "text-ledger"
                          : "text-brick"
                      }`}
                    >
                      {suggestion.transaction.direction === "INFLOW" ? "+" : "−"}
                      {formatAmount(suggestion.transaction.amount)}
                    </span>
                  </div>

                  {suggestion.candidates.length === 0 ? (
                    <div className="mt-3 border-t border-rule pt-3">
                      <p className="text-xs text-muted">
                        Uygun tahmin adayı bulunamadı. Bu gerçek hareket hiç tahmin
                        edilmemiş olabilir — deftere ekleyerek nötrlenmiş bir nakit
                        olayı oluşturabilirsiniz.
                      </p>
                      {promoteFor === suggestion.bankTransactionId ? (
                        <div className="mt-2 flex flex-wrap items-end gap-2">
                          <label className="block">
                            <span className="text-xs text-muted">Kategori</span>
                            <select
                              className={`${INPUT_CLASS} w-64`}
                              value={promoteCategoryId}
                              onChange={(e) => setPromoteCategoryId(e.target.value)}
                            >
                              <option value="">Seçiniz…</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className={SMALL_SECONDARY_BUTTON}
                            disabled={!promoteCategoryId}
                            onClick={() => promote(suggestion.bankTransactionId)}
                          >
                            Deftere Ekle
                          </button>
                          <button
                            type="button"
                            className={SMALL_SECONDARY_BUTTON}
                            onClick={() => setPromoteFor(null)}
                          >
                            Vazgeç
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={`${SMALL_SECONDARY_BUTTON} mt-2`}
                          onClick={() => {
                            setPromoteFor(suggestion.bankTransactionId);
                            setPromoteCategoryId("");
                          }}
                        >
                          Deftere Ekle
                        </button>
                      )}
                    </div>
                  ) : (
                    <ul className="mt-3 space-y-2 border-t border-rule pt-3">
                      {suggestion.candidates.map((candidate) => (
                        <li key={candidate.eventId}>
                          <label className="flex cursor-pointer items-start gap-2">
                            <input
                              type="radio"
                              name={`match-${suggestion.bankTransactionId}`}
                              className="mt-1"
                              checked={
                                selection[suggestion.bankTransactionId] ===
                                candidate.eventId
                              }
                              onChange={() =>
                                setSelection((current) => ({
                                  ...current,
                                  [suggestion.bankTransactionId]: candidate.eventId,
                                }))
                              }
                            />
                            <span className="flex-1">
                              <span className="flex flex-wrap items-baseline gap-2">
                                <Badge tone={CONFIDENCE_TONE[candidate.confidence]}>
                                  {CONFIDENCE_LABEL[candidate.confidence]}
                                </Badge>
                                <span className="tabular text-sm">
                                  {candidate.event.dueDate}
                                </span>
                                <span className="tabular text-sm">
                                  {formatAmount(candidate.event.amount)}
                                </span>
                                <span className="text-xs text-muted">
                                  {candidate.event.counterparty ??
                                    candidate.event.description ??
                                    "—"}
                                </span>
                              </span>
                              <span className="block text-xs text-muted">
                                {candidate.reasons.join(" · ")}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                      {selection[suggestion.bankTransactionId] ? (
                        <li>
                          <button
                            type="button"
                            className="text-xs text-muted underline hover:text-ink"
                            onClick={() =>
                              setSelection((current) => {
                                const next = { ...current };
                                delete next[suggestion.bankTransactionId];
                                return next;
                              })
                            }
                          >
                            Seçimi kaldır
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  )}
                </div>
              ))}

              <div className="flex items-center gap-3 border-t border-rule pt-3">
                <button
                  type="button"
                  className={PRIMARY_BUTTON}
                  disabled={selectedCount === 0 || confirming}
                  onClick={confirmSelected}
                >
                  {confirming
                    ? "Onaylanıyor…"
                    : `Seçilenleri Onayla (${selectedCount})`}
                </button>
                <span className="text-xs text-muted">
                  Onay hepsi-ya-da-hiçbiri çalışır; bir çift çakışırsa parti tümüyle
                  reddedilir.
                </span>
              </div>
            </div>
          )
        ) : null}
      </div>
    </Card>
  );
}
