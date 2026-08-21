"use client";

import { useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { useDisplayCurrency } from "@/frontend/lib/display-currency";
import type { DashboardSummary } from "@/shared/types";

export type CategoryType = "EXPENSE" | "INCOME";

interface Params {
  budgetScenarioId: string | null;
  actualScenarioId: string | null;
  fiscalYear: number | null;
  categoryType: CategoryType;
}

type State =
  | { status: "loading" }
  | { status: "ready"; summary: DashboardSummary }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Pano verisi yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

function requestKey(params: Params): string | null {
  if (!params.budgetScenarioId || !params.actualScenarioId || !params.fiscalYear)
    return null;
  return `${params.budgetScenarioId}:${params.actualScenarioId}:${params.fiscalYear}:${params.categoryType}`;
}

/**
 * "loading" render sırasında türetilir (bkz. useBudgetLines.ts'teki aynı
 * kalıp) — effect içinde senkron setState yerine, istenen anahtar ile
 * elimizdeki sonucun anahtarını karşılaştırırız.
 */
export function useDashboardSummary(params: Params) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryKey, setSummaryKey] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  const { queryValue: displayCurrency } = useDisplayCurrency();
  const baseKey = requestKey(params);
  const key = baseKey ? `${baseKey}:${displayCurrency ?? "native"}` : null;
  const { budgetScenarioId, actualScenarioId, fiscalYear, categoryType } = params;

  useEffect(() => {
    if (!key || !budgetScenarioId || !actualScenarioId || !fiscalYear) return;

    const controller = new AbortController();
    const query = new URLSearchParams({
      budgetScenarioId,
      actualScenarioId,
      fiscalYear: String(fiscalYear),
      categoryType,
    });
    if (displayCurrency) query.set("displayCurrency", displayCurrency);

    apiClient
      .get<DashboardSummary>(`/dashboard-summary?${query}`, {
        signal: controller.signal,
      })
      .then((result) => {
        if (controller.signal.aborted) return;
        setSummary(result);
        setSummaryKey(key);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError({ key, message: toMessage(err) });
      });

    return () => controller.abort();
  }, [
    key,
    budgetScenarioId,
    actualScenarioId,
    fiscalYear,
    categoryType,
    displayCurrency,
  ]);

  const state: State = !key
    ? { status: "loading" }
    : error?.key === key
      ? { status: "error", message: error.message }
      : summaryKey === key && summary
        ? { status: "ready", summary }
        : { status: "loading" };

  return { state };
}
