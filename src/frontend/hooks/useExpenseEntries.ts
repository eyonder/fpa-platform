"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { ExpenseEntry, ExpenseEntryStatus } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; entries: ExpenseEntry[] }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Gider kayıtları yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useBudgetLines`teki AYNI desen: "loading" effect İÇİNDE setState ile
 * DEĞİL, render sırasında istenen anahtara (burada: filtre dizgisi) göre
 * TÜRETİLİR — bkz. o dosyadaki yorum. */
export function useExpenseEntries(
  scenarioId: string | null,
  filters?: { costCenterId?: string; status?: ExpenseEntryStatus },
) {
  const requestKey = scenarioId
    ? `${scenarioId}:${filters?.costCenterId ?? ""}:${filters?.status ?? ""}`
    : null;

  const [result, setResult] = useState<{ key: string; entries: ExpenseEntry[] } | null>(
    null,
  );
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!scenarioId || !requestKey) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ scenarioId });
    if (filters?.costCenterId) params.set("costCenterId", filters.costCenterId);
    if (filters?.status) params.set("status", filters.status);

    apiClient
      .get<ExpenseEntry[]>(`/expense-entries?${params.toString()}`, {
        signal: controller.signal,
      })
      .then((entries) => {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, entries });
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError({ key: requestKey, message: toMessage(err) });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, attempt]);

  const state: State = !requestKey
    ? { status: "loading" }
    : error?.key === requestKey
      ? { status: "error", message: error.message }
      : result?.key === requestKey
        ? { status: "ready", entries: result.entries }
        : { status: "loading" };

  const reload = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
