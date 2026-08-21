"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { BankAccount } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; accounts: BankAccount[] }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Banka hesapları yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useTreasuryMappings` ile AYNI desen — TEK, parametresiz istek. */
export function useBankAccounts() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    apiClient
      .get<BankAccount[]>("/treasury/bank-accounts", { signal: controller.signal })
      .then((accounts) => {
        if (!controller.signal.aborted) setState({ status: "ready", accounts });
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

/** "Odeabank (USD)" — hesap seçicilerde ortak etiket. */
export function bankAccountLabel(account: BankAccount): string {
  return `${account.bankName} (${account.currency})`;
}
