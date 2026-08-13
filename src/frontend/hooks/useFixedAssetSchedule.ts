"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { DepreciationScheduleMonth } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; months: DepreciationScheduleMonth[] }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Amortisman programı yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useAllocationKey`teki AYNI desen: "loading" render sırasında TÜRETİLİR. */
export function useFixedAssetSchedule(id: string | null) {
  const [result, setResult] = useState<{
    id: string;
    months: DepreciationScheduleMonth[];
  } | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();

    apiClient
      .get<DepreciationScheduleMonth[]>(
        `/fixed-assets/${encodeURIComponent(id)}/schedule`,
        {
          signal: controller.signal,
        },
      )
      .then((months) => {
        if (controller.signal.aborted) return;
        setResult({ id, months });
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError({ id, message: toMessage(err) });
      });

    return () => controller.abort();
  }, [id, attempt]);

  const state: State = !id
    ? { status: "loading" }
    : error?.id === id
      ? { status: "error", message: error.message }
      : result?.id === id
        ? { status: "ready", months: result.months }
        : { status: "loading" };

  const reload = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
