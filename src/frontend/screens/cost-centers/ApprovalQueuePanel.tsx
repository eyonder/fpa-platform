"use client";

import { useState } from "react";

import { Card } from "@/frontend/components/ui/Card";
import { useExpenseEntries } from "@/frontend/hooks/useExpenseEntries";
import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { formatAmount } from "@/frontend/lib/format";
import type { BudgetLine, CostCenter } from "@/shared/types";

const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const SECONDARY_BUTTON =
  "rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const DANGER_BUTTON =
  "rounded-md border border-brick px-4 py-2 text-sm font-medium text-brick transition-colors hover:bg-brick-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2 focus-visible:outline-none";

/**
 * SADECE `ADMIN`/`BUDGET_MANAGER`e gösterilir (bkz. CostCentersScreen.tsx'teki
 * `CAN_APPROVE_ROLES` — UX amaçlıdır, asıl yetki sınırı backend'de
 * `expense-entry:approve` iznidir; `DATA_ENTRY` kendi gönderdiği kaydı
 * doğrudan uç noktaya istek atarak da onaylayamaz, 403 alır).
 *
 * Onaylanan kayıtları bütçeye yazmak AYRI bir adımdır ("Bütçeye Yaz"): bu,
 * onay kuyruğundaki TÜM ONAYLANMIŞ kayıtları süpürüp
 * `budgetLineService.bulkUpsert`e (kaynak: EXPENSE) yazar. Tahsis anahtarları
 * bu toplamı DEĞİŞTİRMEZ — sadece aşağıdaki raporlama panelinde iç dağılımı
 * gösterir (bkz. ExpenseAllocationReportPanel.tsx).
 */
export function ApprovalQueuePanel({
  scenarioId,
  costCenters,
}: {
  scenarioId: string;
  costCenters: CostCenter[];
}) {
  const { state, reload } = useExpenseEntries(scenarioId, { status: "SUBMITTED" });
  const costCenterById = new Map(costCenters.map((cc) => [cc.id, cc]));
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [committedLines, setCommittedLines] = useState<BudgetLine[] | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  const approve = async (id: string) => {
    setActionError(null);
    try {
      await apiClient.post(`/expense-entries/${id}/approve`, {});
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Onaylanamadı.");
    }
  };

  const confirmReject = async () => {
    if (!rejectingId) return;
    setActionError(null);
    try {
      await apiClient.post(`/expense-entries/${rejectingId}/reject`, {
        reason: rejectReason,
      });
      setRejectingId(null);
      setRejectReason("");
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Reddedilemedi.");
    }
  };

  const commit = async () => {
    setCommitting(true);
    setCommitError(null);
    try {
      const result = await apiClient.post<BudgetLine[]>("/expense-entries/commit", {
        scenarioId,
      });
      setCommittedLines(result);
      reload();
    } catch (err) {
      setCommitError(err instanceof ApiError ? err.message : "Bütçeye yazılamadı.");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Card
      title="Onay Kuyruğu"
      hint="Bütçeye Yaz, onaylanmış TÜM kayıtları kategori/ay bazında toplayıp bütçeye işler."
    >
      {state.status === "loading" ? (
        <p className="text-sm text-muted">Yükleniyor…</p>
      ) : null}
      {state.status === "error" ? (
        <p className="text-sm text-brick">{state.message}</p>
      ) : null}

      {state.status === "ready" ? (
        state.entries.length === 0 ? (
          <p className="text-sm text-muted">Onay bekleyen gider kaydı yok.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-muted">
                <th className="py-2 pr-3">Gider Merkezi</th>
                <th className="py-2 pr-3">Ay</th>
                <th className="py-2 pr-3">Tutar</th>
                <th className="py-2 pr-3">Gönderen</th>
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
                  <td className="py-2 pr-3">{entry.month}</td>
                  <td className="py-2 pr-3">{formatAmount(entry.amount, "TRY")}</td>
                  <td className="py-2 pr-3 text-muted">
                    {entry.submittedByUserName ?? "—"}
                  </td>
                  <td className="space-x-2 py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => approve(entry.id)}
                      className={SECONDARY_BUTTON}
                    >
                      Onayla
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingId(entry.id);
                        setRejectReason("");
                      }}
                      className={DANGER_BUTTON}
                    >
                      Reddet
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}

      {rejectingId ? (
        <div className="mt-4 space-y-3 rounded-md bg-paper p-4">
          <label className="block text-sm font-medium text-ink">Red Gerekçesi</label>
          <input
            required
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none"
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={confirmReject}
              disabled={!rejectReason}
              className={DANGER_BUTTON}
            >
              Reddet
            </button>
            <button
              type="button"
              onClick={() => setRejectingId(null)}
              className={SECONDARY_BUTTON}
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : null}

      {actionError ? <p className="mt-3 text-sm text-brick">{actionError}</p> : null}

      <div className="mt-6 border-t border-rule pt-4">
        <button
          type="button"
          onClick={commit}
          disabled={committing}
          className={PRIMARY_BUTTON}
        >
          {committing ? "Yazılıyor…" : "Bütçeye Yaz"}
        </button>
        {commitError ? <p className="mt-3 text-sm text-brick">{commitError}</p> : null}
        {committedLines ? (
          <p className="mt-3 text-sm text-ledger">
            {committedLines.length} bütçe satırı güncellendi — Bütçe Girişi ekranından
            kontrol edebilirsiniz.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
