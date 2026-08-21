"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { BankTransactionEntry } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; transactions: BankTransactionEntry[] }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Banka hareketleri yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useSalesBillingMilestones`teki AYNI desen: filtreye göre PARAMETRELİ bir
 * hook olduğu için "loading" durumu efekt gövdesinde setState ile DEĞİL,
 * render sırasında etiketli state'ten TÜRETİLİR (react-hooks/set-state-in-effect). */
export function useBankTransactions(onlyUnmatched: boolean) {
  const key = onlyUnmatched ? "unmatched" : "all";

  const [result, setResult] = useState<{
    key: string;
    transactions: BankTransactionEntry[];
  } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const query = onlyUnmatched ? "?onlyUnmatched=true" : "";

    apiClient
      .get<BankTransactionEntry[]>(`/treasury/bank-transactions${query}`, {
        signal: controller.signal,
      })
      .then((transactions) => {
        if (controller.signal.aborted) return;
        setResult({ key: onlyUnmatched ? "unmatched" : "all", transactions });
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError({ key: onlyUnmatched ? "unmatched" : "all", message: toMessage(err) });
      });

    return () => controller.abort();
  }, [onlyUnmatched, attempt]);

  const state: State =
    error?.key === key
      ? { status: "error", message: error.message }
      : result?.key === key
        ? { status: "ready", transactions: result.transactions }
        : { status: "loading" };

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { state, reload };
}
