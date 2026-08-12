"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/frontend/components/ui/Badge";
import { Card } from "@/frontend/components/ui/Card";
import { useExpenseEntries } from "@/frontend/hooks/useExpenseEntries";
import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { formatAmount } from "@/frontend/lib/format";
import type {
  BudgetCategory,
  BudgetSheet,
  CostCenter,
  ExpenseEntryStatus,
} from "@/shared/types";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const SECONDARY_BUTTON =
  "rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";

const STATUS_LABEL: Record<ExpenseEntryStatus, string> = {
  DRAFT: "Taslak",
  SUBMITTED: "Onayda",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
  COMMITTED: "Bütçeye Yazıldı",
};

const STATUS_TONE: Record<ExpenseEntryStatus, "neutral" | "ledger" | "brick"> = {
  DRAFT: "neutral",
  SUBMITTED: "ledger",
  APPROVED: "ledger",
  REJECTED: "brick",
  COMMITTED: "neutral",
};

/** Bir senaryonun EXPENSE türündeki bütçe kategorilerini `/budget-lines`ten
 * türetir — ayrı bir "gider türü" uç noktası YOK (bkz. cost-center.ts'teki not).
 * `CostCentersScreen` bunu BİR KEZ çağırıp hem bu panele hem de
 * `ExpenseAllocationReportPanel`a prop olarak geçirir (gereksiz tekrar
 * isteği önlemek için). */
export function useExpenseCategories(scenarioId: string | null) {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);

  useEffect(() => {
    if (!scenarioId) return;
    apiClient
      .get<BudgetSheet>(`/budget-lines?scenarioId=${encodeURIComponent(scenarioId)}`)
      .then((sheet) =>
        setCategories(sheet.categories.filter((c) => c.type === "EXPENSE")),
      )
      .catch(() => setCategories([]));
  }, [scenarioId]);

  return categories;
}

export function ExpenseEntriesPanel({
  scenarioId,
  costCenters,
  categories,
}: {
  scenarioId: string;
  costCenters: CostCenter[];
  categories: BudgetCategory[];
}) {
  const { state, reload } = useExpenseEntries(scenarioId);
  const costCenterById = new Map(costCenters.map((cc) => [cc.id, cc]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const submitEntry = async (id: string) => {
    try {
      await apiClient.post(`/expense-entries/${id}/submit`, {});
      reload();
    } catch {
      // Hata mesajı satırda gösterilmez — kısa/olası olmayan bir yol (durum
      // değişmişse liste zaten yeniden yüklenip yeni durumu gösterir.
    }
  };

  return (
    <Card
      title="Gider Kayıtları"
      hint={state.status === "ready" ? `${state.entries.length} kayıt` : undefined}
    >
      {state.status === "loading" ? (
        <p className="text-sm text-muted">Yükleniyor…</p>
      ) : null}
      {state.status === "error" ? (
        <p className="text-sm text-brick">{state.message}</p>
      ) : null}

      {state.status === "ready" ? (
        state.entries.length === 0 ? (
          <p className="text-sm text-muted">Bu senaryo için henüz gider kaydı yok.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-muted">
                <th className="py-2 pr-3">Gider Merkezi</th>
                <th className="py-2 pr-3">Gider Türü</th>
                <th className="py-2 pr-3">Ay</th>
                <th className="py-2 pr-3">Tutar</th>
                <th className="py-2 pr-3">Durum</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {state.entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="tabular border-b border-rule last:border-0"
                >
                  <td className="py-2 pr-3">
                    {costCenterById.get(entry.costCenterId)?.name ?? entry.costCenterId}
                  </td>
                  <td className="py-2 pr-3">
                    {categoryById.get(entry.categoryId)?.name ?? entry.categoryId}
                  </td>
                  <td className="py-2 pr-3">{entry.month}</td>
                  <td className="py-2 pr-3">{formatAmount(entry.amount, "TRY")}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={STATUS_TONE[entry.status]}>
                      {STATUS_LABEL[entry.status]}
                    </Badge>
                    {entry.status === "REJECTED" && entry.rejectionReason ? (
                      <p className="mt-1 text-xs text-brick">{entry.rejectionReason}</p>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3">
                    {entry.status === "DRAFT" || entry.status === "REJECTED" ? (
                      <button
                        type="button"
                        onClick={() => submitEntry(entry.id)}
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
        )
      ) : null}

      <NewExpenseEntryForm
        scenarioId={scenarioId}
        costCenters={costCenters}
        categories={categories}
        onCreated={reload}
      />
    </Card>
  );
}

function NewExpenseEntryForm({
  scenarioId,
  costCenters,
  categories,
  onCreated,
}: {
  scenarioId: string;
  costCenters: CostCenter[];
  categories: BudgetCategory[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [costCenterId, setCostCenterId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [month, setMonth] = useState("1");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${SECONDARY_BUTTON} mt-4`}
      >
        + Yeni Gider Kaydı
      </button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/expense-entries", {
        scenarioId,
        costCenterId,
        categoryId,
        month: Number(month),
        amount: Number(amount),
      });
      setAmount("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gider kaydı eklenemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-md bg-paper p-4">
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-sm font-medium text-ink">Gider Merkezi</label>
          <select
            required
            value={costCenterId}
            onChange={(e) => setCostCenterId(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Seçin…</option>
            {costCenters.map((cc) => (
              <option key={cc.id} value={cc.id}>
                {cc.code} — {cc.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Gider Türü</label>
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Seçin…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Ay</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className={INPUT_CLASS}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Tutar (TRY)</label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
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
