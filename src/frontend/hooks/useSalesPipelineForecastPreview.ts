"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { SalesPipelineForecastPreview } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; preview: SalesPipelineForecastPreview }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Boru hattı tahmini hesaplanamadı. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useDepreciationPreview`teki AYNI desen: "loading" render sırasında TÜRETİLİR. */
export function useSalesPipelineForecastPreview(scenarioId: string | null) {
  const [result, setResult] = useState<{
    scenarioId: string;
    preview: SalesPipelineForecastPreview;
  } | null>(null);
  const [error, setError] = useState<{ scenarioId: string; message: string } | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!scenarioId) return;

    const controller = new AbortController();

    apiClient
      .get<SalesPipelineForecastPreview>(
        `/sales-opportunities/pipeline-forecast-preview?scenarioId=${encodeURIComponent(scenarioId)}`,
        { signal: controller.signal },
      )
      .then((preview) => {
        if (controller.signal.aborted) return;
        setResult({ scenarioId, preview });
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError({ scenarioId, message: toMessage(err) });
      });

    return () => controller.abort();
  }, [scenarioId, attempt]);

  const state: State = !scenarioId
    ? { status: "loading" }
    : error?.scenarioId === scenarioId
      ? { status: "error", message: error.message }
      : result?.scenarioId === scenarioId
        ? { status: "ready", preview: result.preview }
        : { status: "loading" };

  const reload = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
