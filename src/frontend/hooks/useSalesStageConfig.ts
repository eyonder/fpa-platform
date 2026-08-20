"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { SalesStageConfigEntry } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; entries: SalesStageConfigEntry[] }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Aşama/kazanma olasılığı tablosu yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useVukAmortismanConfig`teki AYNI desen — TEK, parametresiz istek
 * (yeniden anahtarlama sorunu yok), bu yüzden basit `useState` başlangıç
 * değeri yeterli. */
export function useSalesStageConfig() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    apiClient
      .get<SalesStageConfigEntry[]>("/sales-stage-config", {
        signal: controller.signal,
      })
      .then((entries) => {
        if (!controller.signal.aborted) setState({ status: "ready", entries });
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
