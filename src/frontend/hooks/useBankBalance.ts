"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { BankBalanceSnapshot } from "@/shared/types";

interface BalancePayload {
  latest: BankBalanceSnapshot | null;
  history: BankBalanceSnapshot[];
}

type State =
  | { status: "loading" }
  | { status: "ready"; balance: BalancePayload }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Top bakiye yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useTreasuryMappings` ile AYNI desen — TEK, parametresiz istek, bu yüzden
 * basit `useState<State>({status:"loading"})` biçimi kullanılabilir. */
export function useBankBalance() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    apiClient
      .get<BalancePayload>("/treasury/bank-balance", { signal: controller.signal })
      .then((balance) => {
        if (!controller.signal.aborted) setState({ status: "ready", balance });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: toMessage(error) });
        }
      });

    return () => controller.abort();
  }, [attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
