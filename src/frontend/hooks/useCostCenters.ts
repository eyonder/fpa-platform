"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { CostCenter } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; costCenters: CostCenter[] }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Gider merkezleri yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `usePersonnel`teki AYNI desen — bkz. o dosyadaki yorum. */
export function useCostCenters() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    apiClient
      .get<CostCenter[]>("/cost-centers", { signal: controller.signal })
      .then((costCenters) => {
        if (!controller.signal.aborted) setState({ status: "ready", costCenters });
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
