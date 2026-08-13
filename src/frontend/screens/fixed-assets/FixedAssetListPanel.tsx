"use client";

import { useState } from "react";

import { Badge } from "@/frontend/components/ui/Badge";
import { Card } from "@/frontend/components/ui/Card";
import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { formatAmount, formatDate } from "@/frontend/lib/format";
import type {
  CashFlowProjectionEntry,
  FixedAsset,
  FixedAssetCategory,
  FixedAssetStatus,
  VukAmortismanConfigEntry,
} from "@/shared/types";

import { CATEGORY_LABEL } from "./category-labels";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const SECONDARY_BUTTON =
  "rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";

const STATUS_LABEL: Record<FixedAssetStatus, string> = {
  DRAFT: "Taslak",
  SUBMITTED: "Onayda",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
};

const STATUS_TONE: Record<FixedAssetStatus, "neutral" | "ledger" | "brick"> = {
  DRAFT: "neutral",
  SUBMITTED: "ledger",
  APPROVED: "ledger",
  REJECTED: "brick",
};

export function FixedAssetListPanel({
  assets,
  vukConfig,
  selectedId,
  onSelect,
  onCreated,
  onSubmitted,
}: {
  assets: FixedAsset[];
  vukConfig: VukAmortismanConfigEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreated: () => void;
  onSubmitted: () => void;
}) {
  const submitAsset = async (id: string) => {
    try {
      await apiClient.post(`/fixed-assets/${id}/submit`, {});
      onSubmitted();
    } catch {
      // Durum değişmişse liste zaten yeniden yüklenip yeni durumu gösterir.
    }
  };

  return (
    <Card title="Sabit Kıymetler" hint={`${assets.length} kayıt`}>
      {assets.length === 0 ? (
        <p className="text-sm text-muted">Henüz sabit kıymet eklenmedi.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-muted">
              <th className="py-2 pr-3">Varlık</th>
              <th className="py-2 pr-3">Kategori</th>
              <th className="py-2 pr-3">Alım Tarihi</th>
              <th className="py-2 pr-3">Tutar</th>
              <th className="py-2 pr-3">Durum</th>
              <th className="py-2 pr-3" />
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr
                key={asset.id}
                onClick={() => onSelect(asset.id)}
                className={`tabular cursor-pointer border-b border-rule last:border-0 hover:bg-paper ${
                  selectedId === asset.id ? "bg-ledger-soft" : ""
                }`}
              >
                <td className="py-2 pr-3 font-medium text-ink">{asset.assetName}</td>
                <td className="py-2 pr-3">{CATEGORY_LABEL[asset.category]}</td>
                <td className="py-2 pr-3">{formatDate(asset.acquisitionDate)}</td>
                <td className="py-2 pr-3">{formatAmount(asset.baseValue, "TRY")}</td>
                <td className="py-2 pr-3">
                  <Badge tone={STATUS_TONE[asset.status]}>
                    {STATUS_LABEL[asset.status]}
                  </Badge>
                </td>
                <td className="py-2 pr-3">
                  {asset.status === "DRAFT" || asset.status === "REJECTED" ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        submitAsset(asset.id);
                      }}
                      className={SECONDARY_BUTTON}
                    >
                      Onaya Gönder
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <NewFixedAssetForm vukConfig={vukConfig} onCreated={onCreated} />
    </Card>
  );
}

function NewFixedAssetForm({
  vukConfig,
  onCreated,
}: {
  vukConfig: VukAmortismanConfigEntry[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [category, setCategory] = useState<FixedAssetCategory>("MACHINERY_EQUIPMENT");
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [baseValue, setBaseValue] = useState("");
  const [usefulLifeYearsOverride, setUsefulLifeYearsOverride] = useState("");
  const [cashFlows, setCashFlows] = useState<CashFlowProjectionEntry[]>([]);
  const [discountRate, setDiscountRate] = useState("0.10");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedConfig = vukConfig.find((c) => c.category === category);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${SECONDARY_BUTTON} mt-4`}
      >
        + Yeni Sabit Kıymet
      </button>
    );
  }

  const addCashFlowRow = () => {
    const nextYear =
      cashFlows.length > 0 ? cashFlows[cashFlows.length - 1].year + 1 : 1;
    setCashFlows((prev) => [...prev, { year: nextYear, amount: 0 }]);
  };

  const updateCashFlow = (index: number, patch: Partial<CashFlowProjectionEntry>) => {
    setCashFlows((prev) =>
      prev.map((cf, i) => (i === index ? { ...cf, ...patch } : cf)),
    );
  };

  const removeCashFlow = (index: number) => {
    setCashFlows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/fixed-assets", {
        assetName,
        category,
        acquisitionDate,
        baseValue: Number(baseValue),
        usefulLifeYearsOverride:
          category === "LEASEHOLD_IMPROVEMENTS" && usefulLifeYearsOverride
            ? Number(usefulLifeYearsOverride)
            : undefined,
        cashFlowProjection: cashFlows,
        discountRate: Number(discountRate),
      });
      setAssetName("");
      setAcquisitionDate("");
      setBaseValue("");
      setUsefulLifeYearsOverride("");
      setCashFlows([]);
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sabit kıymet eklenemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-md bg-paper p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-ink">Varlık Adı</label>
          <input
            required
            value={assetName}
            onChange={(e) => setAssetName(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Kategori</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as FixedAssetCategory)}
            className={INPUT_CLASS}
          >
            {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {selectedConfig ? (
            <p className="mt-1 text-xs text-muted">
              VUK: %{(selectedConfig.annualRate * 100).toFixed(2)} /{" "}
              {selectedConfig.usefulLifeYears} yıl ({selectedConfig.vukReference})
            </p>
          ) : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Alım Tarihi</label>
          <input
            required
            type="date"
            value={acquisitionDate}
            onChange={(e) => setAcquisitionDate(e.target.value)}
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
            value={baseValue}
            onChange={(e) => setBaseValue(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        {category === "LEASEHOLD_IMPROVEMENTS" ? (
          <div>
            <label className="block text-sm font-medium text-ink">
              Sözleşme Süresi (yıl) — boşsa varsayılan 5 yıl kullanılır
            </label>
            <input
              type="number"
              min="1"
              value={usefulLifeYearsOverride}
              onChange={(e) => setUsefulLifeYearsOverride(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        ) : null}
        <div>
          <label className="block text-sm font-medium text-ink">
            İskonto Oranı (NPV için, ör. 0.10 = %10)
          </label>
          <input
            required
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={discountRate}
            onChange={(e) => setDiscountRate(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">
          Beklenen Nakit Akışları (yıllık, TRY — negatif de olabilir)
        </label>
        {cashFlows.map((cf, i) => (
          <div key={i} className="mt-2 flex items-center gap-2">
            <span className="text-sm text-muted">Yıl</span>
            <input
              type="number"
              min="1"
              value={cf.year}
              onChange={(e) => updateCashFlow(i, { year: Number(e.target.value) })}
              className="w-20 rounded-md border border-rule bg-surface px-2 py-1 text-sm"
            />
            <input
              type="number"
              step="0.01"
              value={cf.amount}
              onChange={(e) => updateCashFlow(i, { amount: Number(e.target.value) })}
              className="flex-1 rounded-md border border-rule bg-surface px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => removeCashFlow(i)}
              className={SECONDARY_BUTTON}
            >
              Kaldır
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addCashFlowRow}
          className={`${SECONDARY_BUTTON} mt-2`}
        >
          + Nakit Akışı Ekle
        </button>
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
