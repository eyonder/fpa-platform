"use client";

import { useState } from "react";

import { Badge } from "@/frontend/components/ui/Badge";
import { Card } from "@/frontend/components/ui/Card";
import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { formatAmount, formatDate } from "@/frontend/lib/format";
import type {
  SalesOpportunity,
  SalesOpportunityStage,
  SalesStageConfigEntry,
} from "@/shared/types";

import { STAGE_LABEL, STAGE_TONE } from "./stage-labels";

const OPEN_STAGE_OPTIONS: SalesOpportunityStage[] = [
  "LEAD",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
];

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const SECONDARY_BUTTON =
  "rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const DANGER_BUTTON =
  "rounded-md border border-brick px-3 py-1.5 text-xs font-medium text-brick transition-colors hover:bg-brick-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2 focus-visible:outline-none";
const SMALL_SECONDARY_BUTTON =
  "rounded-md border border-rule px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";

function winProbabilityLabel(
  opportunity: SalesOpportunity,
  stageConfig: SalesStageConfigEntry[],
): string {
  if (opportunity.winProbabilityOverride !== null) {
    return `%${(opportunity.winProbabilityOverride * 100).toFixed(0)} (özel)`;
  }
  const config = stageConfig.find((c) => c.stage === opportunity.stage);
  return config ? `%${(config.defaultWinProbability * 100).toFixed(0)}` : "—";
}

export function SalesOpportunityListPanel({
  opportunities,
  stageConfig,
  onChanged,
}: {
  opportunities: SalesOpportunity[];
  stageConfig: SalesStageConfigEntry[];
  onChanged: () => void;
}) {
  const [actionError, setActionError] = useState<string | null>(null);

  const close = async (id: string, outcome: "WON" | "LOST") => {
    setActionError(null);
    try {
      await apiClient.post(`/sales-opportunities/${id}/close`, { outcome });
      onChanged();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Fırsat kapatılamadı.");
    }
  };

  const reopen = async (id: string) => {
    setActionError(null);
    try {
      await apiClient.post(`/sales-opportunities/${id}/reopen`, {});
      onChanged();
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Fırsat yeniden açılamadı.",
      );
    }
  };

  return (
    <Card title="Satış Fırsatları" hint={`${opportunities.length} kayıt`}>
      {opportunities.length === 0 ? (
        <p className="text-sm text-muted">Henüz satış fırsatı eklenmedi.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-muted">
              <th className="py-2 pr-3">Müşteri</th>
              <th className="py-2 pr-3">Fırsat</th>
              <th className="py-2 pr-3">Beklenen Kapanış</th>
              <th className="py-2 pr-3">Tutar</th>
              <th className="py-2 pr-3">Aşama</th>
              <th className="py-2 pr-3">Kazanma Olasılığı</th>
              <th className="py-2 pr-3" />
            </tr>
          </thead>
          <tbody>
            {opportunities.map((opportunity) => (
              <tr
                key={opportunity.id}
                className="tabular border-b border-rule last:border-0"
              >
                <td className="py-2 pr-3 font-medium text-ink">
                  {opportunity.customerName}
                </td>
                <td className="py-2 pr-3">{opportunity.dealName}</td>
                <td className="py-2 pr-3">
                  {formatDate(opportunity.expectedCloseDate)}
                </td>
                <td className="py-2 pr-3">
                  {formatAmount(opportunity.expectedValue, "TRY")}
                </td>
                <td className="py-2 pr-3">
                  <Badge tone={STAGE_TONE[opportunity.stage]}>
                    {STAGE_LABEL[opportunity.stage]}
                  </Badge>
                </td>
                <td className="py-2 pr-3">
                  {winProbabilityLabel(opportunity, stageConfig)}
                </td>
                <td className="space-x-2 py-2 pr-3">
                  {opportunity.closedAt ? (
                    <button
                      type="button"
                      onClick={() => reopen(opportunity.id)}
                      className={SMALL_SECONDARY_BUTTON}
                    >
                      Yeniden Aç
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => close(opportunity.id, "WON")}
                        className={SMALL_SECONDARY_BUTTON}
                      >
                        Kazanıldı
                      </button>
                      <button
                        type="button"
                        onClick={() => close(opportunity.id, "LOST")}
                        className={DANGER_BUTTON}
                      >
                        Kaybedildi
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {actionError ? <p className="mt-3 text-sm text-brick">{actionError}</p> : null}

      <NewSalesOpportunityForm onCreated={onChanged} />
    </Card>
  );
}

function NewSalesOpportunityForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [dealName, setDealName] = useState("");
  const [expectedValue, setExpectedValue] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [stage, setStage] = useState<SalesOpportunityStage>("LEAD");
  const [winProbabilityOverride, setWinProbabilityOverride] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${SECONDARY_BUTTON} mt-4`}
      >
        + Yeni Satış Fırsatı
      </button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/sales-opportunities", {
        customerName,
        dealName,
        expectedValue: Number(expectedValue),
        expectedCloseDate,
        stage,
        winProbabilityOverride: winProbabilityOverride
          ? Number(winProbabilityOverride)
          : undefined,
      });
      setCustomerName("");
      setDealName("");
      setExpectedValue("");
      setExpectedCloseDate("");
      setStage("LEAD");
      setWinProbabilityOverride("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Satış fırsatı eklenemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-md bg-paper p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-ink">Müşteri Adı</label>
          <input
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Fırsat Adı</label>
          <input
            required
            value={dealName}
            onChange={(e) => setDealName(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Tutar (TRY)</label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={expectedValue}
            onChange={(e) => setExpectedValue(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">
            Beklenen Kapanış Tarihi
          </label>
          <input
            required
            type="date"
            value={expectedCloseDate}
            onChange={(e) => setExpectedCloseDate(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Aşama</label>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as SalesOpportunityStage)}
            className={INPUT_CLASS}
          >
            {OPEN_STAGE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {STAGE_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">
            Kazanma Olasılığı (özel, ör. 0.30 = %30) — boşsa aşamanın varsayılanı
            kullanılır
          </label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={winProbabilityOverride}
            onChange={(e) => setWinProbabilityOverride(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {error ? <p className="text-sm text-brick">{error}</p> : null}

      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className={PRIMARY_BUTTON}>
          {submitting ? "Ekleniyor…" : "Ekle"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={SECONDARY_BUTTON}
        >
          Vazgeç
        </button>
      </div>
    </form>
  );
}
