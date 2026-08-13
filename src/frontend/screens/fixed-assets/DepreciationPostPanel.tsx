"use client";

import { useState } from "react";

import { Card } from "@/frontend/components/ui/Card";
import { useDepreciationPreview } from "@/frontend/hooks/useDepreciationPreview";
import { useScenarios } from "@/frontend/hooks/useScenarios";
import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { formatAmount } from "@/frontend/lib/format";
import type { BudgetLine } from "@/shared/types";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";

/**
 * Senaryo bazlı, TEKRAR ÇALIŞTIRILABİLİR bütçeye yazma — `payroll`teki
 * önizle/yaz ikilisiyle AYNI disiplin: önizleme HİÇBİR ŞEY yazmaz, "Bütçeye
 * Yaz" ONAYLANMIŞ TÜM sabit kıymetlerin bu mali yıla düşen amortismanını
 * toplayıp yazar (bkz. depreciation.service.ts). SADECE ADMIN/BUDGET_MANAGER'a
 * gösterilir (bkz. FixedAssetsScreen.tsx'teki CAN_APPROVE_ROLES).
 */
export function DepreciationPostPanel() {
  const { state: scenariosState } = useScenarios();
  const [scenarioId, setScenarioId] = useState("");
  const { state: previewState, reload: reloadPreview } = useDepreciationPreview(
    scenarioId || null,
  );
  const [committing, setCommitting] = useState(false);
  const [committedLines, setCommittedLines] = useState<BudgetLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commit = async () => {
    if (!scenarioId) return;
    setCommitting(true);
    setError(null);
    try {
      const result = await apiClient.post<BudgetLine[]>(
        "/fixed-assets/depreciation-commit",
        {
          scenarioId,
        },
      );
      setCommittedLines(result);
      reloadPreview();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Bütçeye yazılamadı.");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Card
      title="Amortismanı Bütçeye Yaz"
      hint="Onaylanmış TÜM sabit kıymetlerin seçili senaryonun mali yılına düşen amortismanını toplar."
    >
      <div className="flex-1">
        <label className="block text-sm font-medium text-ink">Senaryo</label>
        <select
          value={scenarioId}
          onChange={(e) => {
            setScenarioId(e.target.value);
            setCommittedLines(null);
          }}
          className={INPUT_CLASS}
        >
          <option value="">Seçin…</option>
          {scenariosState.status === "ready"
            ? scenariosState.scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.fiscalYear})
                </option>
              ))
            : null}
        </select>
      </div>

      {previewState.status === "loading" && scenarioId ? (
        <p className="mt-3 text-sm text-muted">Hesaplanıyor…</p>
      ) : null}
      {previewState.status === "error" ? (
        <p className="mt-3 text-sm text-brick">{previewState.message}</p>
      ) : null}

      {previewState.status === "ready" ? (
        <div className="mt-4 space-y-4">
          {previewState.preview.monthlyTotals.length === 0 ? (
            <p className="text-sm text-muted">
              {previewState.preview.fiscalYear} mali yılına düşen amortisman yok (onaylı
              varlık bulunamadı ya da bu yıl hiçbirinin programına denk gelmiyor).
            </p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-xs text-muted">
                    <th className="py-2 pr-3">Ay</th>
                    <th className="py-2 pr-3">Toplam Amortisman</th>
                  </tr>
                </thead>
                <tbody>
                  {previewState.preview.monthlyTotals.map((t) => (
                    <tr
                      key={t.month}
                      className="tabular border-b border-rule last:border-0"
                    >
                      <td className="py-2 pr-3">{t.month}</td>
                      <td className="py-2 pr-3">
                        {formatAmount(t.totalDepreciation, "TRY")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-ink">
                  Varlık bazlı ayrıntı ({previewState.preview.assets.length} varlık)
                </summary>
                <ul className="tabular mt-2 space-y-1 text-xs">
                  {previewState.preview.assets.map((a) => (
                    <li key={a.fixedAssetId}>
                      {a.assetName}:{" "}
                      {a.monthlyAmounts
                        .map((m) => `${m.month}. ay ${formatAmount(m.amount)}`)
                        .join(", ")}
                    </li>
                  ))}
                </ul>
              </details>

              <button
                type="button"
                onClick={commit}
                disabled={committing}
                className={PRIMARY_BUTTON}
              >
                {committing ? "Yazılıyor…" : "Bütçeye Yaz"}
              </button>
            </>
          )}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-brick">{error}</p> : null}
      {committedLines ? (
        <p className="mt-3 text-sm text-ledger">
          {committedLines.length} bütçe satırı güncellendi — Bütçe Girişi ekranından
          kontrol edebilirsiniz.
        </p>
      ) : null}
    </Card>
  );
}
