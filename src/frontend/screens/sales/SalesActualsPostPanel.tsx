"use client";

import { useState } from "react";

import { Card } from "@/frontend/components/ui/Card";
import { useSalesActualsPreview } from "@/frontend/hooks/useSalesActualsPreview";
import { useScenarios } from "@/frontend/hooks/useScenarios";
import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { formatAmount } from "@/frontend/lib/format";
import type { BudgetLine } from "@/shared/types";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";

/**
 * Senaryo bazlı, TEKRAR ÇALIŞTIRILABİLİR bütçeye yazma — `DepreciationPostPanel`
 * İLE AYNI disiplin: önizleme HİÇBİR ŞEY yazmaz, "Bütçeye Yaz" KAZANILAN
 * (WON) TÜM fırsatların GERÇEK kapanış ayına (closedAt) düşen TAM tutarını
 * toplayıp yazar (bkz. sales-forecast.service.ts). SADECE ADMIN/BUDGET_MANAGER'a
 * gösterilir (bkz. SalesScreen.tsx'teki CAN_COMMIT_ROLES).
 */
export function SalesActualsPostPanel() {
  const { state: scenariosState } = useScenarios();
  const [scenarioId, setScenarioId] = useState("");
  const { state: previewState, reload: reloadPreview } = useSalesActualsPreview(
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
        "/sales-opportunities/actuals-commit",
        { scenarioId },
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
      title="Gerçekleşen Satışları Bütçeye Yaz"
      hint="Kazanılan (WON) TÜM fırsatların gerçek kapanış ayına (closedAt) düşen toplam tutarını 'Gelir' kategorisine yazar."
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
              {previewState.preview.fiscalYear} mali yılına düşen gerçekleşen satış yok
              (kazanılan fırsat bulunamadı ya da kapanış tarihi bu yıla denk gelmiyor).
            </p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-xs text-muted">
                    <th className="py-2 pr-3">Ay</th>
                    <th className="py-2 pr-3">Toplam Gerçekleşen</th>
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
                        {formatAmount(t.totalActual, "TRY")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-ink">
                  Fırsat bazlı ayrıntı ({previewState.preview.opportunities.length}{" "}
                  fırsat)
                </summary>
                <ul className="tabular mt-2 space-y-1 text-xs">
                  {previewState.preview.opportunities.map((o) => (
                    <li key={o.opportunityId}>
                      {o.customerName} — {o.dealName}: {o.month}. ay{" "}
                      {formatAmount(o.amount)}
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

      <p className="mt-3 text-xs text-muted">
        Uyarı: bu ve &quot;Boru Hattı Tahminini Bütçeye Yaz&quot; işlemi AYNI kategoriye
        (&quot;Gelir&quot;) yazar. Farklı senaryo seçin — aynı senaryoyu ikisi için de
        kullanırsanız, ikinci yazma birincinin tutarlarının üzerine yazar.
      </p>

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
