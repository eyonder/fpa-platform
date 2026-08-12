"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { AllocationKey } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; key: AllocationKey | null }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Tahsis anahtarı yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useBudgetLines`teki AYNI desen: "loading" effect İÇİNDE setState ile
 * DEĞİL, render sırasında istenen gider merkezine göre TÜRETİLİR. Seçili
 * gider merkezinin (kaynak olarak) tahsis anahtarını getirir — yoksa `key: null`. */
export function useAllocationKey(costCenterId: string | null) {
  const [result, setResult] = useState<{
    costCenterId: string;
    key: AllocationKey | null;
  } | null>(null);
  const [error, setError] = useState<{ costCenterId: string; message: string } | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!costCenterId) return;

    const controller = new AbortController();

    apiClient
      .get<AllocationKey | null>(
        `/cost-centers/${encodeURIComponent(costCenterId)}/allocation-key`,
        { signal: controller.signal },
      )
      .then((key) => {
        if (controller.signal.aborted) return;
        setResult({ costCenterId, key });
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError({ costCenterId, message: toMessage(err) });
      });

    return () => controller.abort();
  }, [costCenterId, attempt]);

  const state: State = !costCenterId
    ? { status: "loading" }
    : error?.costCenterId === costCenterId
      ? { status: "error", message: error.message }
      : result?.costCenterId === costCenterId
        ? { status: "ready", key: result.key }
        : { status: "loading" };

  const reload = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
