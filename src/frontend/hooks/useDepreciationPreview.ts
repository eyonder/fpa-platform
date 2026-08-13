"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { DepreciationPreview } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; preview: DepreciationPreview }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Amortisman önizlemesi hesaplanamadı. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useAllocationKey`teki AYNI desen: "loading" render sırasında TÜRETİLİR. */
export function useDepreciationPreview(scenarioId: string | null) {
  const [result, setResult] = useState<{
    scenarioId: string;
    preview: DepreciationPreview;
  } | null>(null);
  const [error, setError] = useState<{ scenarioId: string; message: string } | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!scenarioId) return;

    const controller = new AbortController();

    apiClient
      .get<DepreciationPreview>(
        `/fixed-assets/depreciation-preview?scenarioId=${encodeURIComponent(scenarioId)}`,
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
