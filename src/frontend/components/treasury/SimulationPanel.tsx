"use client";

import { useState } from "react";

import { Badge } from "@/frontend/components/ui/Badge";
import { Card } from "@/frontend/components/ui/Card";
import { formatAmount } from "@/frontend/lib/format";
import type { TreasuryAdjustment } from "@/shared/types";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const SECONDARY_BUTTON =
  "rounded-md border border-rule px-4 py-2 text-sm transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const SMALL_SECONDARY_BUTTON =
  "rounded-md border border-rule px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";

type Builder = "SPOT_LOAN" | "SHIFT_BY_FILTER" | "ADD_EVENT" | "PAYROLL_RAISE";

const BUILDER_LABEL: Record<Builder, string> = {
  SPOT_LOAN: "Spot Kredi Ekle",
  SHIFT_BY_FILTER: "Ödemeleri Ötele",
  ADD_EVENT: "Tek Seferlik Hareket",
  PAYROLL_RAISE: "Bordro Zammı",
};

function describe(adjustment: TreasuryAdjustment, currency: string): string {
  switch (adjustment.kind) {
    case "SPOT_LOAN":
      return `${adjustment.label}: ${formatAmount(adjustment.principal, currency)} — ${adjustment.drawDate}, ${adjustment.termDays} gün${
        adjustment.annualRatePct !== undefined ? `, %${adjustment.annualRatePct}` : ""
      }`;
    case "SHIFT_BY_FILTER":
      return `${adjustment.filter.direction === "INFLOW" ? "Tahsilatlar" : "Ödemeler"} ${adjustment.shiftDays > 0 ? "+" : ""}${adjustment.shiftDays} gün ötelendi`;
    case "ADD_EVENT":
      return `${adjustment.label}: ${adjustment.direction === "INFLOW" ? "+" : "−"}${formatAmount(adjustment.amount, currency)} @ ${adjustment.date}`;
    case "PAYROLL_RAISE":
      return `Bordro %${adjustment.percent} — ${adjustment.effectiveFrom} itibarıyla`;
    default:
      return adjustment.kind;
  }
}

/**
 * WHAT-IF paneli — düzeltme listesi kurar, `POST /api/treasury/simulate`e
 * gönderir. EPHEMERAL: hiçbir şey kaydedilmez (kullanıcıyla teyit edilmiş
 * mimari karar), panel kapanınca senaryo kaybolur.
 *
 * Sadece `treasury-simulation:run` sahibi roller görür — asıl sınır yine
 * backend'dedir (bkz. authorize.ts).
 */
export function SimulationPanel({
  currency,
  adjustments,
  running,
  onAdd,
  onRemove,
  onRun,
  onClear,
}: {
  currency: string;
  adjustments: TreasuryAdjustment[];
  running: boolean;
  onAdd: (adjustment: TreasuryAdjustment) => void;
  onRemove: (id: string) => void;
  onRun: () => void;
  onClear: () => void;
}) {
  const [builder, setBuilder] = useState<Builder>("SPOT_LOAN");

  // Spot kredi
  const [principal, setPrincipal] = useState("");
  const [drawDate, setDrawDate] = useState("");
  const [termDays, setTermDays] = useState("30");
  const [annualRatePct, setAnnualRatePct] = useState("48");

  // Öteleme
  const [shiftDirection, setShiftDirection] = useState<"INFLOW" | "OUTFLOW">("OUTFLOW");
  const [shiftDays, setShiftDays] = useState("30");

  // Tek seferlik hareket
  const [eventLabel, setEventLabel] = useState("");
  const [eventDirection, setEventDirection] = useState<"INFLOW" | "OUTFLOW">("OUTFLOW");
  const [eventAmount, setEventAmount] = useState("");
  const [eventDate, setEventDate] = useState("");

  // Bordro zammı
  const [raisePercent, setRaisePercent] = useState("30");
  const [raiseFrom, setRaiseFrom] = useState("");

  const nextId = () => `adj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const add = () => {
    if (builder === "SPOT_LOAN") {
      if (!principal || !drawDate) return;
      onAdd({
        kind: "SPOT_LOAN",
        id: nextId(),
        label: "Spot kredi",
        principal: Number(principal),
        drawDate,
        termDays: Number(termDays) || 30,
        annualRatePct: annualRatePct === "" ? undefined : Number(annualRatePct),
      });
      setPrincipal("");
      return;
    }
    if (builder === "SHIFT_BY_FILTER") {
      onAdd({
        kind: "SHIFT_BY_FILTER",
        id: nextId(),
        filter: { direction: shiftDirection },
        shiftDays: Number(shiftDays) || 0,
      });
      return;
    }
    if (builder === "ADD_EVENT") {
      if (!eventLabel || !eventAmount || !eventDate) return;
      onAdd({
        kind: "ADD_EVENT",
        id: nextId(),
        label: eventLabel,
        direction: eventDirection,
        amount: Number(eventAmount),
        date: eventDate,
      });
      setEventLabel("");
      setEventAmount("");
      return;
    }
    if (!raiseFrom) return;
    onAdd({
      kind: "PAYROLL_RAISE",
      id: nextId(),
      percent: Number(raisePercent) || 0,
      effectiveFrom: raiseFrom,
    });
  };

  return (
    <Card
      title="What-If Simülasyonu"
      hint={adjustments.length > 0 ? `${adjustments.length} düzeltme` : "kaydedilmez"}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Düzeltmeler <strong>kaydedilmez</strong> — sadece bu ekranda, geçici olarak
          hesaplanır. Uygulama sırası sabittir: önce tutarlar ölçeklenir, sonra tarihler
          ötelenir, en son yeni satırlar eklenir.
        </p>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(BUILDER_LABEL) as Builder[]).map((kind) => (
            <button
              key={kind}
              type="button"
              className={
                builder === kind
                  ? "rounded-md bg-ledger-soft px-3 py-1.5 text-xs font-medium text-ledger"
                  : SMALL_SECONDARY_BUTTON
              }
              onClick={() => setBuilder(kind)}
            >
              {BUILDER_LABEL[kind]}
            </button>
          ))}
        </div>

        {builder === "SPOT_LOAN" ? (
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="text-xs text-muted">Anapara</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted">Kullandırım</span>
              <input
                type="date"
                value={drawDate}
                onChange={(e) => setDrawDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted">Vade (gün)</span>
              <input
                type="number"
                min="1"
                value={termDays}
                onChange={(e) => setTermDays(e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted">Yıllık faiz (%)</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={annualRatePct}
                onChange={(e) => setAnnualRatePct(e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
          </div>
        ) : null}

        {builder === "SHIFT_BY_FILTER" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-muted">Hangi satırlar</span>
              <select
                value={shiftDirection}
                onChange={(e) =>
                  setShiftDirection(e.target.value as "INFLOW" | "OUTFLOW")
                }
                className={INPUT_CLASS}
              >
                <option value="OUTFLOW">Tüm ödemeler</option>
                <option value="INFLOW">Tüm tahsilatlar</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted">Kaç gün (negatif = öne al)</span>
              <input
                type="number"
                value={shiftDays}
                onChange={(e) => setShiftDays(e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
          </div>
        ) : null}

        {builder === "ADD_EVENT" ? (
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="text-xs text-muted">Etiket</span>
              <input
                type="text"
                value={eventLabel}
                onChange={(e) => setEventLabel(e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted">Yön</span>
              <select
                value={eventDirection}
                onChange={(e) =>
                  setEventDirection(e.target.value as "INFLOW" | "OUTFLOW")
                }
                className={INPUT_CLASS}
              >
                <option value="OUTFLOW">Ödeme</option>
                <option value="INFLOW">Tahsilat</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted">Tutar</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={eventAmount}
                onChange={(e) => setEventAmount(e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted">Tarih</span>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
          </div>
        ) : null}

        {builder === "PAYROLL_RAISE" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs text-muted">Zam oranı (%)</span>
              <input
                type="number"
                value={raisePercent}
                onChange={(e) => setRaisePercent(e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted">Yürürlük</span>
              <input
                type="date"
                value={raiseFrom}
                onChange={(e) => setRaiseFrom(e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
          </div>
        ) : null}

        <button type="button" className={SMALL_SECONDARY_BUTTON} onClick={add}>
          Düzeltme Ekle
        </button>

        {adjustments.length > 0 ? (
          <ul className="space-y-2 border-t border-rule pt-3">
            {adjustments.map((adjustment) => (
              <li
                key={adjustment.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex items-center gap-2">
                  <Badge tone="ledger">
                    {BUILDER_LABEL[adjustment.kind as Builder] ?? adjustment.kind}
                  </Badge>
                  <span>{describe(adjustment, currency)}</span>
                </span>
                <button
                  type="button"
                  className="text-xs text-muted underline hover:text-ink"
                  onClick={() => onRemove(adjustment.id)}
                >
                  Kaldır
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex items-center gap-2 border-t border-rule pt-3">
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={adjustments.length === 0 || running}
            onClick={onRun}
          >
            {running ? "Hesaplanıyor…" : "Simülasyonu Çalıştır"}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON}
            disabled={running}
            onClick={onClear}
          >
            Temizle
          </button>
        </div>
      </div>
    </Card>
  );
}
