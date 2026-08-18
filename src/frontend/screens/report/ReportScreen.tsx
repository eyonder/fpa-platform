"use client";

import { useMemo, useState } from "react";

import { CategoryBarChart } from "@/frontend/components/charts/CategoryBarChart";
import { StatTile } from "@/frontend/components/charts/StatTile";
import { Badge } from "@/frontend/components/ui/Badge";
import { Card } from "@/frontend/components/ui/Card";
import { useBudgetLines } from "@/frontend/hooks/useBudgetLines";
import { useCashFlowReport } from "@/frontend/hooks/useCashFlowReport";
import { useScenarios } from "@/frontend/hooks/useScenarios";
import { useVarianceReport } from "@/frontend/hooks/useVarianceReport";
import { formatAmount } from "@/frontend/lib/format";
import { MONTHS } from "@/shared/constants/months";
import type { VarianceStatus } from "@/shared/types";

const STATUS_LABEL: Record<VarianceStatus, string> = {
  FAVORABLE: "Olumlu",
  UNFAVORABLE: "Olumsuz",
  ON_TARGET: "Hedefte",
  MIXED: "Karışık",
};

const STATUS_TONE: Record<VarianceStatus, "neutral" | "ledger" | "brick"> = {
  FAVORABLE: "ledger",
  UNFAVORABLE: "brick",
  ON_TARGET: "neutral",
  MIXED: "neutral",
};

export function ReportScreen() {
  const { state: scenarioState } = useScenarios();
  const scenarios = scenarioState.status === "ready" ? scenarioState.scenarios : [];
  const budgetScenarios = scenarios.filter((s) => s.kind === "BUDGET");
  const actualScenarios = scenarios.filter((s) => s.kind === "ACTUAL");

  const [selectedBudgetId, setSelectedBudgetId] = useState("");
  const [selectedActualId, setSelectedActualId] = useState("");
  const [periodStart, setPeriodStart] = useState(1);
  const [manualPeriodEnd, setManualPeriodEnd] = useState<number | null>(null);

  const budgetScenarioId = selectedBudgetId || (budgetScenarios[0]?.id ?? "");
  const actualScenarioId = selectedActualId || (actualScenarios[0]?.id ?? "");

  // Varsayılan dönem sonu "Aralık" DEĞİL, gerçekleşen senaryosunda verinin
  // GERÇEKTEN dolu olduğu son aydır — aksi hâlde henüz girilmemiş aylar 0
  // gerçekleşen gibi görünüp sahte, dramatik bir sapma üretir (bkz.
  // dashboard.service.ts'teki aynı sorunun kök nedeni). Kullanıcı elle
  // seçince (manualPeriodEnd) bu çıkarım bir daha devreye girmez.
  const { sheetState: actualSheetState } = useBudgetLines(actualScenarioId || null);
  const inferredPeriodEnd = useMemo(() => {
    if (actualSheetState.status !== "ready") return null;
    let lastMonthWithData = 0;
    for (const line of actualSheetState.sheet.lines) {
      if (line.amount !== 0 && line.month > lastMonthWithData)
        lastMonthWithData = line.month;
    }
    return lastMonthWithData || 12;
  }, [actualSheetState]);

  const periodEnd = manualPeriodEnd ?? inferredPeriodEnd ?? 12;

  const { state } = useVarianceReport({
    budgetScenarioId: budgetScenarioId || null,
    actualScenarioId: actualScenarioId || null,
    periodStart,
    periodEnd,
  });

  // Nakit Akış, Sapma raporuyla AYNI Kapsam seçimlerini (bütçe senaryosu +
  // dönem) kullanır — ayrı bir senaryo/dönem seçici EKLEMEZ.
  const { state: cashFlowState } = useCashFlowReport({
    scenarioId: budgetScenarioId || null,
    periodStart,
    periodEnd,
  });

  const noScenarios =
    scenarioState.status === "ready" &&
    (budgetScenarios.length === 0 || actualScenarios.length === 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rapor</h1>
        <p className="mt-1 text-sm text-muted">
          Seçilen dönem için kategori bazında bütçe-gerçekleşen kırılımı — hangi kalemin
          plana göre nerede durduğunu gösterir.
        </p>
      </div>

      <Card title="Kapsam">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label
              className="block text-xs font-medium text-muted"
              htmlFor="rpt-budget"
            >
              Bütçe Senaryosu
            </label>
            <select
              id="rpt-budget"
              value={budgetScenarioId}
              onChange={(e) => setSelectedBudgetId(e.target.value)}
              disabled={budgetScenarios.length === 0}
              className="mt-1 rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none"
            >
              {budgetScenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.fiscalYear})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              className="block text-xs font-medium text-muted"
              htmlFor="rpt-actual"
            >
              Gerçekleşen Senaryosu
            </label>
            <select
              id="rpt-actual"
              value={actualScenarioId}
              onChange={(e) => setSelectedActualId(e.target.value)}
              disabled={actualScenarios.length === 0}
              className="mt-1 rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none"
            >
              {actualScenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.fiscalYear})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted" htmlFor="rpt-start">
              Dönem
            </label>
            <div className="mt-1 flex items-center gap-2">
              <select
                id="rpt-start"
                value={periodStart}
                onChange={(e) => setPeriodStart(Number(e.target.value))}
                className="rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none"
              >
                {MONTHS.map((m) => (
                  <option key={m.month} value={m.month}>
                    {m.label}
                  </option>
                ))}
              </select>
              <span className="text-sm text-muted">–</span>
              <select
                value={periodEnd}
                onChange={(e) => setManualPeriodEnd(Number(e.target.value))}
                className="rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none"
              >
                {MONTHS.map((m) => (
                  <option key={m.month} value={m.month}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      {noScenarios ? (
        <Card title="Kategori Kırılımı">
          <p className="py-6 text-sm text-muted">
            Bu kiracı için hem Bütçe hem Gerçekleşen türünde en az birer senaryo
            gerekiyor — henüz ikisi birden yok.
          </p>
        </Card>
      ) : null}

      {!noScenarios && state.status === "loading" ? (
        <Card title="Kategori Kırılımı">
          <p className="py-6 text-sm text-muted">Rapor yükleniyor…</p>
        </Card>
      ) : null}

      {!noScenarios && state.status === "error" ? (
        <Card title="Kategori Kırılımı">
          <p className="py-6 text-sm text-brick">{state.message}</p>
        </Card>
      ) : null}

      {!noScenarios && state.status === "ready" ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatTile
              label="Toplam Bütçe"
              value={formatAmount(
                state.report.total.budgetAmount,
                state.report.currency,
              )}
            />
            <StatTile
              label="Toplam Gerçekleşen"
              value={formatAmount(
                state.report.total.actualAmount,
                state.report.currency,
              )}
            />
            <StatTile
              label="Sapma"
              value={
                state.report.total.variancePercent !== null
                  ? `%${state.report.total.variancePercent > 0 ? "+" : ""}${state.report.total.variancePercent}`
                  : "—"
              }
              hint={formatAmount(
                state.report.total.varianceAmount,
                state.report.currency,
              )}
              tone={
                state.report.total.status === "FAVORABLE"
                  ? "ledger"
                  : state.report.total.status === "UNFAVORABLE"
                    ? "brick"
                    : "neutral"
              }
            />
          </div>

          <Card title="Kategori Kırılımı" hint={`${periodStart}–${periodEnd}`}>
            <CategoryBarChart
              rows={state.report.rows}
              currency={state.report.currency}
            />
          </Card>

          <Card title="Detay Tablo">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-xs tracking-wide text-muted uppercase">
                    <th className="pb-2 font-medium">Kategori</th>
                    <th className="pb-2 text-right font-medium">Bütçe</th>
                    <th className="pb-2 text-right font-medium">Gerçekleşen</th>
                    <th className="pb-2 text-right font-medium">Sapma</th>
                    <th className="pb-2 text-right font-medium">Sapma %</th>
                    <th className="pb-2 text-right font-medium">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {state.report.rows.map((row) => (
                    <tr
                      key={row.categoryId}
                      className="border-b border-rule/60 last:border-0"
                    >
                      <td className="py-3 font-medium">{row.categoryName}</td>
                      <td className="tabular py-3 text-right">
                        {formatAmount(row.budgetAmount)}
                      </td>
                      <td className="tabular py-3 text-right">
                        {formatAmount(row.actualAmount)}
                      </td>
                      <td className="tabular py-3 text-right">
                        {formatAmount(row.varianceAmount)}
                      </td>
                      <td className="tabular py-3 text-right">
                        {row.variancePercent !== null ? `%${row.variancePercent}` : "—"}
                      </td>
                      <td className="py-3 text-right">
                        <Badge tone={STATUS_TONE[row.status]}>
                          {STATUS_LABEL[row.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            title="Nakit Akış"
            hint="Amortisman + Sabit Kıymet Alımı ile tahakkuktan nakde geçiş"
          >
            <p className="mb-4 text-xs text-muted">
              Amortisman nakit çıkışı değildir, geri eklenir; sabit kıymet alım tutarı
              ise P&amp;L&apos;de görünmeyen gerçek bir nakit çıkışıdır. Tahsilat/ödeme
              vadesi varsayılmaz — diğer tüm kalemlerin aynı ay içinde nakde dönüştüğü
              kabul edilir.
            </p>

            {cashFlowState.status === "loading" ? (
              <p className="py-6 text-sm text-muted">Nakit akış hesaplanıyor…</p>
            ) : null}
            {cashFlowState.status === "error" ? (
              <p className="py-6 text-sm text-brick">{cashFlowState.message}</p>
            ) : null}

            {cashFlowState.status === "ready" ? (
              <>
                <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
                  <StatTile
                    label="Net Bütçe (Tahakkuk)"
                    value={formatAmount(
                      cashFlowState.report.totals.netBudget,
                      cashFlowState.report.currency,
                    )}
                  />
                  <StatTile
                    label="Net Nakit Akışı"
                    value={formatAmount(
                      cashFlowState.report.totals.netCashFlow,
                      cashFlowState.report.currency,
                    )}
                  />
                  <StatTile
                    label="Fark (Amortisman − Sabit Kıymet Alımı)"
                    value={formatAmount(
                      cashFlowState.report.totals.netCashFlow -
                        cashFlowState.report.totals.netBudget,
                      cashFlowState.report.currency,
                    )}
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-rule text-left text-xs tracking-wide text-muted uppercase">
                        <th className="pb-2 font-medium">Ay</th>
                        <th className="pb-2 text-right font-medium">Net Bütçe</th>
                        <th className="pb-2 text-right font-medium">+ Amortisman</th>
                        <th className="pb-2 text-right font-medium">
                          − Sabit Kıymet Alımı
                        </th>
                        <th className="pb-2 text-right font-medium">Net Nakit Akışı</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashFlowState.report.months.map((row) => (
                        <tr
                          key={row.month}
                          className="border-b border-rule/60 last:border-0"
                        >
                          <td className="py-3 font-medium">
                            {MONTHS.find((m) => m.month === row.month)?.label ??
                              row.month}
                          </td>
                          <td className="tabular py-3 text-right">
                            {formatAmount(row.netBudget)}
                          </td>
                          <td className="tabular py-3 text-right">
                            {formatAmount(row.depreciationAddBack)}
                          </td>
                          <td className="tabular py-3 text-right">
                            {formatAmount(row.capexOutflow)}
                          </td>
                          <td className="tabular py-3 text-right font-medium">
                            {formatAmount(row.netCashFlow)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-ink font-medium">
                        <td className="py-3">TOPLAM</td>
                        <td className="tabular py-3 text-right">
                          {formatAmount(cashFlowState.report.totals.netBudget)}
                        </td>
                        <td className="tabular py-3 text-right">
                          {formatAmount(
                            cashFlowState.report.totals.depreciationAddBack,
                          )}
                        </td>
                        <td className="tabular py-3 text-right">
                          {formatAmount(cashFlowState.report.totals.capexOutflow)}
                        </td>
                        <td className="tabular py-3 text-right">
                          {formatAmount(cashFlowState.report.totals.netCashFlow)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  );
}
