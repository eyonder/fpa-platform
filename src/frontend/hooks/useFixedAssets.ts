"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { FixedAsset, FixedAssetCategory, FixedAssetStatus } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; assets: FixedAsset[] }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Sabit kıymetler yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useExpenseEntries`teki AYNI desen: "loading" effect İÇİNDE setState ile
 * DEĞİL, render sırasında istenen filtre anahtarına göre TÜRETİLİR. */
export function useFixedAssets(filters?: {
  category?: FixedAssetCategory;
  status?: FixedAssetStatus;
}) {
  const requestKey = `${filters?.category ?? ""}:${filters?.status ?? ""}`;

  const [result, setResult] = useState<{ key: string; assets: FixedAsset[] } | null>(
    null,
  );
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (filters?.category) params.set("category", filters.category);
    if (filters?.status) params.set("status", filters.status);
    const query = params.toString();

    apiClient
      .get<FixedAsset[]>(`/fixed-assets${query ? `?${query}` : ""}`, {
        signal: controller.signal,
      })
      .then((assets) => {
        if (controller.signal.aborted) return;
        setResult({ key: requestKey, assets });
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError({ key: requestKey, message: toMessage(err) });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, attempt]);

  const state: State =
    error?.key === requestKey
      ? { status: "error", message: error.message }
      : result?.key === requestKey
        ? { status: "ready", assets: result.assets }
        : { status: "loading" };

  const reload = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
