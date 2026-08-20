"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { SalesOpportunity, SalesOpportunityStage } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; opportunities: SalesOpportunity[] }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Satış fırsatları yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useFixedAssets`teki AYNI desen: "loading" effect İÇİNDE setState ile
 * DEĞİL, render sırasında istenen filtre anahtarına göre TÜRETİLİR. */
export function useSalesOpportunities(filters?: {
  stage?: SalesOpportunityStage;
  open?: boolean;
}) {
  const requestKey = `${filters?.stage ?? ""}:${filters?.open ?? ""}`;

  const [result, setResult] = useState<{
    key: string;
    opportunities: SalesOpportunity[];
  } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (filters?.stage) params.set("stage", filters.stage);
    if (filters?.open !== undefined) params.set("open", String(filters.open));
    const query = params.toString();

    apiClient
      .get<SalesOpportunity[]>(`/sales-opportunities${query ? `?${query}` : ""}`, {
        signal: controller.signal,
      })
      .then((opportunities) => {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, opportunities });
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError({ key: requestKey, message: toMessage(err) });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, attempt]);

  const state: State =
    error?.key === requestKey
      ? { status: "error", message: error.message }
      : result?.key === requestKey
        ? { status: "ready", opportunities: result.opportunities }
        : { status: "loading" };

  const reload = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
