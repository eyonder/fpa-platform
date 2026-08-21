"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { useDisplayCurrency } from "@/frontend/lib/display-currency";
import type { IncludeDerivedSources, TreasuryProjection } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; projection: TreasuryProjection }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Nakit projeksiyonu yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

export interface ProjectionOptions {
  granularity: "DAY" | "WEEK";
  horizonDays: number;
  includeDerived: Required<IncludeDerivedSources>;
}

/** Senaryoya ve seçeneklere PARAMETRELİ — `useBankTransactions` ile aynı
 * etiketli-state deseni (react-hooks/set-state-in-effect). */
export function useTreasuryProjection(
  scenarioId: string | null,
  options: ProjectionOptions,
) {
  const { queryValue: displayCurrency } = useDisplayCurrency();

  const key = scenarioId
    ? [
        scenarioId,
        displayCurrency ?? "native",
        options.granularity,
        options.horizonDays,
        options.includeDerived.sales,
        options.includeDerived.capex,
        options.includeDerived.payroll,
        options.includeDerived.pipeline,
      ].join("|")
    : null;

  const [result, setResult] = useState<{
    key: string;
    projection: TreasuryProjection;
  } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!scenarioId || !key) return;
    const controller = new AbortController();

    const params = new URLSearchParams({
      scenarioId,
      granularity: options.granularity,
      horizonDays: String(options.horizonDays),
      includeSales: String(options.includeDerived.sales),
      includeCapex: String(options.includeDerived.capex),
      includePayroll: String(options.includeDerived.payroll),
      includePipeline: String(options.includeDerived.pipeline),
    });
    if (displayCurrency) params.set("displayCurrency", displayCurrency);

    apiClient
      .get<TreasuryProjection>(`/treasury/projection?${params.toString()}`, {
        signal: controller.signal,
      })
      .then((projection) => {
        if (controller.signal.aborted) return;
        setResult({ key, projection });
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError({ key, message: toMessage(err) });
      });

    return () => controller.abort();
  }, [
    scenarioId,
    key,
    attempt,
    displayCurrency,
    options.granularity,
    options.horizonDays,
    options.includeDerived.sales,
    options.includeDerived.capex,
    options.includeDerived.payroll,
    options.includeDerived.pipeline,
  ]);

  const state: State =
    key === null
      ? { status: "loading" }
      : error?.key === key
        ? { status: "error", message: error.message }
        : result?.key === key
          ? { status: "ready", projection: result.projection }
          : { status: "loading" };

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, reload };
}
