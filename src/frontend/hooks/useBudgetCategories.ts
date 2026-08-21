"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { BudgetCategory } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; categories: BudgetCategory[] }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Bütçe kategorileri yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useCostCenters`teki AYNI desen — TEK, parametresiz istek. */
export function useBudgetCategories() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    apiClient
      .get<BudgetCategory[]>("/budget-categories", { signal: controller.signal })
      .then((categories) => {
        if (!controller.signal.aborted) setState({ status: "ready", categories });
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
