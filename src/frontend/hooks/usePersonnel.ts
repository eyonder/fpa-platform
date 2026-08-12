"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { Employee } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; employees: Employee[] }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Personel listesi yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useScenarios`teki AYNI desen — bkz. o dosyadaki yorum. */
export function usePersonnel() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    apiClient
      .get<Employee[]>("/personnel", { signal: controller.signal })
      .then((employees) => {
        if (!controller.signal.aborted) setState({ status: "ready", employees });
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
