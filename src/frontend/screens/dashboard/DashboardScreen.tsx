"use client";

import { useState } from "react";

import { BudgetTrendChart } from "@/frontend/components/charts/BudgetTrendChart";
import { StatTile } from "@/frontend/components/charts/StatTile";
import { Card } from "@/frontend/components/ui/Card";
import type { CategoryType } from "@/frontend/hooks/useDashboardSummary";
import { useDashboardSummary } from "@/frontend/hooks/useDashboardSummary";
import { useScenarios } from "@/frontend/hooks/useScenarios";
import { formatAmount } from "@/frontend/lib/format";
import { MONTHS } from "@/shared/constants/months";

const CATEGORY_TYPE_LABEL: Record<CategoryType, string> = {
  EXPENSE: "Gider",
  INCOME: "Gelir",
};

export function DashboardScreen() {
  const { state: scenarioState } = useScenarios();
  const scenarios = scenarioState.status === "ready" ? scenarioState.scenarios : [];
  const budgetScenarios = scenarios.filter((s) => s.kind === "BUDGET");
  const actualScenarios = scenarios.filter((s) => s.kind === "ACTUAL");

  const [selectedBudgetId, setSelectedBudgetId] = useState("");
  const [selectedActualId, setSelectedActualId] = useState("");
  const [categoryType, setCategoryType] = useState<CategoryType>("EXPENSE");

  const budgetScenarioId = selectedBudgetId || (budgetScenarios[0]?.id ?? "");
  const actualScenarioId = selectedActualId || (actualScenarios[0]?.id ?? "");
  const budgetScenario = scenarios.find((s) => s.id === budgetScenarioId) ?? null;

  const { state } = useDashboardSummary({
    budgetScenarioId: budgetScenarioId || null,
    actualScenarioId: actualScenarioId || null,
    fiscalYear: budgetScenario?.fiscalYear ?? null,
    categoryType,
  });

  const noScenarios =
    scenarioState.status === "ready" &&
    (budgetScenarios.length === 0 || actualScenarios.length === 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Genel Bakış</h1>
        <p className="mt-1 text-sm text-muted">
          Yıllık bütçe, yılbaşından bugüne gerçekleşen ve bugünden yıl sonuna
          tahminlenen tutarları tek bir eğride gösterir — şirket yöneticileri için bir
          bakışta özet.
        </p>
      </div>

      <Card title="Kapsam">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label
              className="block text-xs font-medium text-muted"
              htmlFor="dash-budget"
            >
              Bütçe Senaryosu
            </label>
            <select
              id="dash-budget"
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
              htmlFor="dash-actual"
            >
              Gerçekleşen Senaryosu
            </label>
            <select
              id="dash-actual"
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

          <div className="ml-auto flex items-center gap-1 rounded-md border border-rule p-0.5">
            {(Object.keys(CATEGORY_TYPE_LABEL) as CategoryType[]).map((type) => (
              <button
                key={type}
                onClick={() => setCategoryType(type)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  categoryType === type
                    ? "bg-ledger-soft text-ledger"
                    : "text-muted hover:text-ink"
                }`}
              >
                {CATEGORY_TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {noScenarios ? (
        <Card title="Yıl İçi Görünüm">
          <p className="py-6 text-sm text-muted">
            Bu kiracı için hem Bütçe hem Gerçekleşen türünde en az birer senaryo
            gerekiyor — henüz ikisi birden yok.
          </p>
        </Card>
      ) : null}

      {!noScenarios && state.status === "loading" ? (
        <Card title="Yıl İçi Görünüm">
          <p className="py-6 text-sm text-muted">Pano yükleniyor…</p>
        </Card>
      ) : null}

      {!noScenarios && state.status === "error" ? (
        <Card title="Yıl İçi Görünüm">
          <p className="py-6 text-sm text-brick">{state.message}</p>
        </Card>
      ) : null}

      {!noScenarios && state.status === "ready" ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label={`Yıllık Bütçe (${CATEGORY_TYPE_LABEL[categoryType]})`}
              value={formatAmount(
                state.summary.kpis.annualBudget,
                state.summary.currency,
              )}
            />
            <StatTile
              label="Gerçekleşen (YB → Bugün)"
              value={formatAmount(state.summary.kpis.ytdActual, state.summary.currency)}
              hint={
                state.summary.asOfMonth > 0
                  ? `Oca – ${MONTHS[state.summary.asOfMonth - 1]?.label ?? ""}`
                  : "Henüz veri yok"
              }
            />
            <StatTile
              label="Kalan Yıl Tahmini"
              value={formatAmount(
                state.summary.kpis.remainingForecast,
                state.summary.currency,
              )}
              hint={
                state.summary.kpis.growthRatePercent !== null
                  ? `Aylık ort. büyüme: %${state.summary.kpis.growthRatePercent}`
                  : "Sabit taşındı (yetersiz veri)"
              }
            />
            <StatTile
              label="Yıl Sonu Projeksiyonu"
              value={formatAmount(
                state.summary.kpis.fullYearProjection,
                state.summary.currency,
              )}
              tone={varianceTone(categoryType, state.summary.kpis.variancePercent)}
              hint={
                state.summary.kpis.variancePercent !== null
                  ? `Bütçeye göre %${state.summary.kpis.variancePercent > 0 ? "+" : ""}${state.summary.kpis.variancePercent}`
                  : undefined
              }
            />
          </div>

          <Card
            title="Yıl İçi Görünüm"
            hint={
              budgetScenario
                ? `${budgetScenario.fiscalYear} · ${CATEGORY_TYPE_LABEL[categoryType]}`
                : undefined
            }
          >
            <BudgetTrendChart
              months={state.summary.months}
              currency={state.summary.currency}
            />
          </Card>
        </>
      ) : null}
    </div>
  );
}

function varianceTone(
  categoryType: CategoryType,
  variancePercent: number | null,
): "neutral" | "ledger" | "brick" {
  if (variancePercent === null || variancePercent === 0) return "neutral";
  const isOverBudget = variancePercent > 0;
  // Giderde bütçenin üstü kötü (brick), gelirde bütçenin üstü iyi (ledger).
  const favorable = categoryType === "INCOME" ? isOverBudget : !isOverBudget;
  return favorable ? "ledger" : "brick";
}
