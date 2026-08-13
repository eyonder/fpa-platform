"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { FixedAsset } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; asset: FixedAsset }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Sabit kıymet yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useAllocationKey`teki AYNI desen: "loading" render sırasında TÜRETİLİR. */
export function useFixedAsset(id: string | null) {
  const [result, setResult] = useState<{ id: string; asset: FixedAsset } | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;

    const controller = new AbortController();

    apiClient
      .get<FixedAsset>(`/fixed-assets/${encodeURIComponent(id)}`, {
        signal: controller.signal,
      })
      .then((asset) => {
        if (controller.signal.aborted) return;
        setResult({ id, asset });
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError({ id, message: toMessage(err) });
      });

    return () => controller.abort();
  }, [id, attempt]);

  const state: State = !id
    ? { status: "loading" }
    : error?.id === id
      ? { status: "error", message: error.message }
      : result?.id === id
        ? { status: "ready", asset: result.asset }
        : { status: "loading" };

  const reload = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
