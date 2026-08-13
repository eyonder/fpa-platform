"use client";

import { useState } from "react";

import { Card } from "@/frontend/components/ui/Card";
import { useFixedAssets } from "@/frontend/hooks/useFixedAssets";
import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { formatAmount, formatDate } from "@/frontend/lib/format";

import { CATEGORY_LABEL } from "./category-labels";

const SECONDARY_BUTTON =
  "rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const DANGER_BUTTON =
  "rounded-md border border-brick px-4 py-2 text-sm font-medium text-brick transition-colors hover:bg-brick-soft disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brick focus-visible:ring-offset-2 focus-visible:outline-none";

/**
 * SADECE `ADMIN`/`BUDGET_MANAGER`e gösterilir (bkz. FixedAssetsScreen.tsx'teki
 * `CAN_APPROVE_ROLES` — UX amaçlıdır, asıl yetki sınırı backend'de
 * `fixed-asset:approve` iznidir; `DATA_ENTRY` kendi gönderdiği kaydı
 * doğrudan uç noktaya istek atarak da onaylayamaz, 403 alır).
 *
 * Bütçeye yazma AYRI bir panelde (`DepreciationPostPanel`) — bkz. o dosyadaki
 * ve `depreciation.service.ts`teki not: bir varlığın amortismanı BİRDEN ÇOK
 * mali yıla yayılır, burada "onayla" ile ORADAKİ "bütçeye yaz" AYRI eylemlerdir.
 */
export function ApprovalQueuePanel({ onDecided }: { onDecided: () => void }) {
  const { state, reload } = useFixedAssets({ status: "SUBMITTED" });
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const approve = async (id: string) => {
    setActionError(null);
    try {
      await apiClient.post(`/fixed-assets/${id}/approve`, {});
      reload();
      onDecided();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Onaylanamadı.");
    }
  };

  const confirmReject = async () => {
    if (!rejectingId) return;
    setActionError(null);
    try {
      await apiClient.post(`/fixed-assets/${rejectingId}/reject`, {
        reason: rejectReason,
      });
      setRejectingId(null);
      setRejectReason("");
      reload();
      onDecided();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Reddedilemedi.");
    }
  };

  return (
    <Card title="Onay Kuyruğu" hint="Sabit kıymet talepleri — onayla/reddet.">
      {state.status === "loading" ? (
        <p className="text-sm text-muted">Yükleniyor…</p>
      ) : null}
      {state.status === "error" ? (
        <p className="text-sm text-brick">{state.message}</p>
      ) : null}

      {state.status === "ready" ? (
        state.assets.length === 0 ? (
          <p className="text-sm text-muted">Onay bekleyen sabit kıymet yok.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs text-muted">
                <th className="py-2 pr-3">Varlık</th>
                <th className="py-2 pr-3">Kategori</th>
                <th className="py-2 pr-3">Alım Tarihi</th>
                <th className="py-2 pr-3">Tutar</th>
                <th className="py-2 pr-3">Gönderen</th>
                <th className="py-2 pr-3" />
              </tr>
            </thead>
            <tbody>
              {state.assets.map((asset) => (
                <tr
                  key={asset.id}
                  className="tabular border-b border-rule last:border-0"
                >
                  <td className="py-2 pr-3 font-medium text-ink">{asset.assetName}</td>
                  <td className="py-2 pr-3">{CATEGORY_LABEL[asset.category]}</td>
                  <td className="py-2 pr-3">{formatDate(asset.acquisitionDate)}</td>
                  <td className="py-2 pr-3">{formatAmount(asset.baseValue, "TRY")}</td>
                  <td className="py-2 pr-3 text-muted">
                    {asset.submittedByUserName ?? "—"}
                  </td>
                  <td className="space-x-2 py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => approve(asset.id)}
                      className={SECONDARY_BUTTON}
                    >
                      Onayla
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingId(asset.id);
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
    </Card>
  );
}
