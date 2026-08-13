"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { VukAmortismanConfigEntry } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; entries: VukAmortismanConfigEntry[] }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "VUK amortisman oranları yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useCostCenters`teki AYNI desen — TEK, parametresiz istek (yeniden
 * anahtarlama sorunu yok), bu yüzden basit `useState` başlangıç değeri yeterli. */
export function useVukAmortismanConfig() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    apiClient
      .get<VukAmortismanConfigEntry[]>("/vuk-amortisman-config", {
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
