"use client";

import { useState } from "react";

import { Badge } from "@/frontend/components/ui/Badge";
import { Card } from "@/frontend/components/ui/Card";
import { useBudgetCategories } from "@/frontend/hooks/useBudgetCategories";
import { useTreasuryMappings } from "@/frontend/hooks/useTreasuryMappings";
import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type {
  CashFlowDirection,
  MappingConfigEntry,
  MappingLayer,
} from "@/shared/types";

import { ThpImportWizard } from "./ThpImportWizard";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const SECONDARY_BUTTON =
  "rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const SMALL_SECONDARY_BUTTON =
  "rounded-md border border-rule px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";

const DIRECTION_LABEL: Record<CashFlowDirection, string> = {
  INFLOW: "Tahsilat",
  OUTFLOW: "Ödeme",
};

const LAYER_LABEL: Record<MappingLayer, string> = {
  CASH: "Nakit (vade taşır)",
  ACCRUAL: "Tahakkuk (nakit olayı üretmez)",
};

/**
 * Hazine > THP Eşleştirme ekranı — kurallar listesi + ekleme/düzenleme/silme,
 * "Varsayılan THP setini yükle" ve Excel içe aktarım sihirbazı (bkz.
 * ThpImportWizard.tsx). SADECE `treasury-mapping:write` sahibi roller
 * (ADMIN/BÜTÇE Yöneticisi) düzenleyebilir — bkz. authorize.ts'teki gerekçe:
 * bir kural GELECEKTEKİ HER içe aktarımı sessizce yeniden sınıflandırır.
 */
export function MappingScreen({ canManageMappings }: { canManageMappings: boolean }) {
  const { state: mappingsState, reload: reloadMappings } = useTreasuryMappings();
  const { state: categoriesState } = useBudgetCategories();
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const categories =
    categoriesState.status === "ready" ? categoriesState.categories : [];

  const seedDefaults = async () => {
    setSeeding(true);
    setSeedError(null);
    try {
      await apiClient.post("/treasury/mappings/seed-defaults", {});
      reloadMappings();
    } catch (err) {
      setSeedError(
        err instanceof ApiError ? err.message : "Varsayılan set yüklenemedi.",
      );
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    try {
      await apiClient.delete(`/treasury/mappings/${id}`);
      reloadMappings();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Kural silinemedi.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">
          Hazine — THP Eşleştirme
        </h1>
        <p className="mt-1 text-sm text-muted">
          Tek Düzen Hesap Planı (THP) hesap kodlarını bütçe kategorilerine eşleyin.
          120/320 gibi bilanço hesapları gerçek vade taşır ve nakit olayı üretir;
          600/770 gibi gelir tablosu hesapları tahakkuktur ve içe aktarımda BİLEREK
          atlanır (aksi halde gelir/gider çift sayılır).
        </p>
      </div>

      <Card
        title="Eşleştirme Kuralları"
        hint={
          mappingsState.status === "ready"
            ? `${mappingsState.mappings.length} kural`
            : ""
        }
      >
        {mappingsState.status === "loading" ? (
          <p className="text-sm text-muted">Yükleniyor…</p>
        ) : null}
        {mappingsState.status === "error" ? (
          <p className="text-sm text-brick">{mappingsState.message}</p>
        ) : null}

        {mappingsState.status === "ready" ? (
          mappingsState.mappings.length === 0 ? (
            <p className="text-sm text-muted">
              Henüz eşleştirme kuralı yok. Aşağıdaki &quot;Varsayılan THP Setini
              Yükle&quot; ile başlayabilir ya da elle kural ekleyebilirsiniz.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-muted">
                  <th className="py-2 pr-3">Hesap Kodu</th>
                  <th className="py-2 pr-3">Hesap Adı</th>
                  <th className="py-2 pr-3">Kategori</th>
                  <th className="py-2 pr-3">Yön</th>
                  <th className="py-2 pr-3">Katman</th>
                  <th className="py-2 pr-3">Varsayılan Vade</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {mappingsState.mappings.map((m: MappingConfigEntry) => (
                  <tr key={m.id} className="tabular border-b border-rule last:border-0">
                    <td className="py-2 pr-3 font-medium text-ink">{m.accountCode}</td>
                    <td className="py-2 pr-3">{m.accountName}</td>
                    <td className="py-2 pr-3">
                      {categories.find((c) => c.id === m.categoryId)?.name ??
                        m.categoryId}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge tone={m.direction === "INFLOW" ? "ledger" : "brick"}>
                        {DIRECTION_LABEL[m.direction]}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge tone={m.layer === "CASH" ? "ledger" : "neutral"}>
                        {LAYER_LABEL[m.layer]}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      {m.defaultTermDays !== null ? `${m.defaultTermDays} gün` : "—"}
                    </td>
                    <td className="py-2 pr-3">
                      {canManageMappings ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(m.id)}
                          className={SMALL_SECONDARY_BUTTON}
                        >
                          Sil
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : null}

        {actionError ? <p className="mt-3 text-sm text-brick">{actionError}</p> : null}

        {canManageMappings ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={seedDefaults}
              disabled={seeding}
              className={SECONDARY_BUTTON}
            >
              {seeding ? "Yükleniyor…" : "Varsayılan THP Setini Yükle"}
            </button>
            {seedError ? <p className="text-sm text-brick">{seedError}</p> : null}
          </div>
        ) : null}

        {canManageMappings ? (
          <NewMappingForm categories={categories} onCreated={reloadMappings} />
        ) : null}
      </Card>

      {canManageMappings ? <ThpImportWizard /> : null}
    </div>
  );
}

function NewMappingForm({
  categories,
  onCreated,
}: {
  categories: { id: string; name: string }[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [direction, setDirection] = useState<CashFlowDirection>("OUTFLOW");
  const [layer, setLayer] = useState<MappingLayer>("CASH");
  const [defaultTermDays, setDefaultTermDays] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveCategoryId = categoryId || (categories[0]?.id ?? "");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${SECONDARY_BUTTON} mt-4`}
      >
        + Yeni Eşleştirme Kuralı
      </button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/treasury/mappings", {
        accountCode,
        accountName,
        categoryId: effectiveCategoryId,
        direction,
        layer,
        defaultTermDays: defaultTermDays ? Number(defaultTermDays) : undefined,
      });
      setAccountCode("");
      setAccountName("");
      setDefaultTermDays("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kural eklenemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-md bg-paper p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-ink">
            Hesap Kodu (önek olarak eşleşir)
          </label>
          <input
            required
            value={accountCode}
            onChange={(e) => setAccountCode(e.target.value)}
            placeholder="ör. 320 ya da 320.05"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Hesap Adı</label>
          <input
            required
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Kategori</label>
          <select
            value={effectiveCategoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={INPUT_CLASS}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Yön</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as CashFlowDirection)}
            className={INPUT_CLASS}
          >
            <option value="INFLOW">Tahsilat</option>
            <option value="OUTFLOW">Ödeme</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Katman</label>
          <select
            value={layer}
            onChange={(e) => setLayer(e.target.value as MappingLayer)}
            className={INPUT_CLASS}
          >
            <option value="CASH">Nakit (vade taşır)</option>
            <option value="ACCRUAL">Tahakkuk (nakit olayı üretmez)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">
            Varsayılan Vade (gün) — opsiyonel
          </label>
          <input
            type="number"
            min="1"
            value={defaultTermDays}
            onChange={(e) => setDefaultTermDays(e.target.value)}
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
