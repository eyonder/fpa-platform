"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { FixedAssetFeasibility } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; feasibility: FixedAssetFeasibility }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "NPV/IRR hesaplanamadı. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useAllocationKey`teki AYNI desen: "loading" render sırasında TÜRETİLİR. */
export function useFixedAssetFeasibility(id: string | null) {
  const [result, setResult] = useState<{
    id: string;
    feasibility: FixedAssetFeasibility;
  } | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();

    apiClient
      .get<FixedAssetFeasibility>(
        `/fixed-assets/${encodeURIComponent(id)}/feasibility`,
        {
          signal: controller.signal,
        },
      )
      .then((feasibility) => {
        if (controller.signal.aborted) return;
        setResult({ id, feasibility });
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
        ? { status: "ready", feasibility: result.feasibility }
        : { status: "loading" };

  const reload = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
