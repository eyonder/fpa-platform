"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { TreasuryPosition } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; position: TreasuryPosition }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Nakit pozisyonu yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** Senaryoya PARAMETRELİ — `useBankTransactions` ile aynı etiketli-state deseni. */
export function useTreasuryPosition(scenarioId: string | null, days = 90) {
  const key = scenarioId ? `${scenarioId}:${days}` : null;

  const [result, setResult] = useState<{
    key: string;
    position: TreasuryPosition;
  } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!scenarioId) return;
    const requestKey = `${scenarioId}:${days}`;
    const controller = new AbortController();

    apiClient
      .get<TreasuryPosition>(
        `/treasury/position?scenarioId=${encodeURIComponent(scenarioId)}&days=${days}`,
        { signal: controller.signal },
      )
      .then((position) => {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, position });
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError({ key: requestKey, message: toMessage(err) });
      });

    return () => controller.abort();
  }, [scenarioId, days, attempt]);

  const state: State =
    key === null
      ? { status: "loading" }
      : error?.key === key
        ? { status: "error", message: error.message }
        : result?.key === key
          ? { status: "ready", position: result.position }
          : { status: "loading" };

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, reload };
}
