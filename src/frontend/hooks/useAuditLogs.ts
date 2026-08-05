"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { AuditLogEntry } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; entries: AuditLogEntry[] }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Denetim kaydı yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

export function useAuditLogs(scenarioId?: string) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const query = scenarioId ? `?scenarioId=${encodeURIComponent(scenarioId)}` : "";

    apiClient
      .get<AuditLogEntry[]>(`/audit-logs${query}`, { signal: controller.signal })
      .then((entries) => {
        if (!controller.signal.aborted) setState({ status: "ready", entries });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({ status: "error", message: toMessage(error) });
      });

    return () => controller.abort();
  }, [scenarioId, attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
