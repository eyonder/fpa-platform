"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { Scenario } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; scenarios: Scenario[] }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Senaryolar yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

export function useScenarios() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    apiClient
      .get<Scenario[]>("/scenarios", { signal: controller.signal })
      .then((scenarios) => {
        if (!controller.signal.aborted) setState({ status: "ready", scenarios });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: toMessage(error) });
        }
      });

    // Bileşen ekrandan kalkarsa isteği iptal et; boşa giden yanıt state'i bozmasın.
    return () => controller.abort();
  }, [attempt]);

  // Kullanıcı etkileşimi: attempt değişince yukarıdaki effect yeniden çalışır.
  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
