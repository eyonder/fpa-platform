"use client";

import { useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { VarianceReport } from "@/shared/types";

interface Params {
  budgetScenarioId: string | null;
  actualScenarioId: string | null;
  periodStart: number;
  periodEnd: number;
}

type State =
  | { status: "loading" }
  | { status: "ready"; report: VarianceReport }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Sapma raporu yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

function requestKey(params: Params): string | null {
  if (!params.budgetScenarioId || !params.actualScenarioId) return null;
  return `${params.budgetScenarioId}:${params.actualScenarioId}:${params.periodStart}:${params.periodEnd}`;
}

/** "loading" render sırasında türetilir — bkz. useDashboardSummary.ts'teki aynı kalıp. */
export function useVarianceReport(params: Params) {
  const [report, setReport] = useState<VarianceReport | null>(null);
  const [reportKey, setReportKey] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  const key = requestKey(params);
  const { budgetScenarioId, actualScenarioId, periodStart, periodEnd } = params;

  useEffect(() => {
    if (!key || !budgetScenarioId || !actualScenarioId) return;

    const controller = new AbortController();
    const query = new URLSearchParams({
      budgetScenarioId,
      actualScenarioId,
      periodStart: String(periodStart),
      periodEnd: String(periodEnd),
    });

    apiClient
      .get<VarianceReport>(`/variance?${query}`, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setReport(result);
        setReportKey(key);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError({ key, message: toMessage(err) });
      });

    return () => controller.abort();
  }, [key, budgetScenarioId, actualScenarioId, periodStart, periodEnd]);

  const state: State = !key
    ? { status: "loading" }
    : error?.key === key
      ? { status: "error", message: error.message }
      : reportKey === key && report
        ? { status: "ready", report }
        : { status: "loading" };

  return { state };
}
