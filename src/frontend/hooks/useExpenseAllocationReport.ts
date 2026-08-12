"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { AllocationReportRow } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; rows: AllocationReportRow[] }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Tahsis raporu yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useBudgetLines`teki AYNI desen: "loading" effect İÇİNDE setState ile
 * DEĞİL, render sırasında istenen senaryoya göre TÜRETİLİR. Sadece BÜTÇEYE
 * YAZILMIŞ (COMMITTED) gider kayıtlarının, tahsis anahtarları uygulandıktan
 * sonra gider merkezleri arasındaki dağılımını getirir. */
export function useExpenseAllocationReport(scenarioId: string | null) {
  const [result, setResult] = useState<{
    scenarioId: string;
    rows: AllocationReportRow[];
  } | null>(null);
  const [error, setError] = useState<{ scenarioId: string; message: string } | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!scenarioId) return;

    const controller = new AbortController();

    apiClient
      .get<AllocationReportRow[]>(
        `/expense-allocation-report?scenarioId=${encodeURIComponent(scenarioId)}`,
        { signal: controller.signal },
      )
      .then((rows) => {
        if (controller.signal.aborted) return;
        setResult({ scenarioId, rows });
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError({ scenarioId, message: toMessage(err) });
      });

    return () => controller.abort();
  }, [scenarioId, attempt]);

  const state: State = !scenarioId
    ? { status: "loading" }
    : error?.scenarioId === scenarioId
      ? { status: "error", message: error.message }
      : result?.scenarioId === scenarioId
        ? { status: "ready", rows: result.rows }
        : { status: "loading" };

  const reload = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
