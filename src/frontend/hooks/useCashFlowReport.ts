"use client";

import { useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { CashFlowReport } from "@/shared/types";

interface Params {
  scenarioId: string | null;
  periodStart: number;
  periodEnd: number;
}

type State =
  | { status: "loading" }
  | { status: "ready"; report: CashFlowReport }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Nakit akış raporu yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

function requestKey(params: Params): string | null {
  if (!params.scenarioId) return null;
  return `${params.scenarioId}:${params.periodStart}:${params.periodEnd}`;
}

/** "loading" render sırasında türetilir — `useVarianceReport.ts`teki AYNI kalıp. */
export function useCashFlowReport(params: Params) {
  const [report, setReport] = useState<CashFlowReport | null>(null);
  const [reportKey, setReportKey] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  const key = requestKey(params);
  const { scenarioId, periodStart, periodEnd } = params;

  useEffect(() => {
    if (!key || !scenarioId) return;

    const controller = new AbortController();
    const query = new URLSearchParams({
      scenarioId,
      periodStart: String(periodStart),
      periodEnd: String(periodEnd),
    });

    apiClient
      .get<CashFlowReport>(`/cash-flow?${query}`, { signal: controller.signal })
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
  }, [key, scenarioId, periodStart, periodEnd]);

  const state: State = !key
    ? { status: "loading" }
    : error?.key === key
      ? { status: "error", message: error.message }
      : reportKey === key && report
        ? { status: "ready", report }
        : { status: "loading" };

  return { state };
}
