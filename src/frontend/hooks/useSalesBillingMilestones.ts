"use client";

import { useCallback, useEffect, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { SalesBillingMilestone } from "@/shared/types";

type State =
  | { status: "loading" }
  | { status: "ready"; milestones: SalesBillingMilestone[] }
  | { status: "error"; message: string };

function toMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "Hakediş faturalama tarihleri yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.";
}

/** `useFixedAsset`teki AYNI desen: "loading" render sırasında TÜRETİLİR. */
export function useSalesBillingMilestones(opportunityId: string | null) {
  const [result, setResult] = useState<{
    opportunityId: string;
    milestones: SalesBillingMilestone[];
  } | null>(null);
  const [error, setError] = useState<{ opportunityId: string; message: string } | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!opportunityId) return;

    const controller = new AbortController();

    apiClient
      .get<SalesBillingMilestone[]>(
        `/sales-opportunities/${encodeURIComponent(opportunityId)}/billing-milestones`,
        { signal: controller.signal },
      )
      .then((milestones) => {
        if (controller.signal.aborted) return;
        setResult({ opportunityId, milestones });
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError({ opportunityId, message: toMessage(err) });
      });

    return () => controller.abort();
  }, [opportunityId, attempt]);

  const state: State = !opportunityId
    ? { status: "loading" }
    : error?.opportunityId === opportunityId
      ? { status: "error", message: error.message }
      : result?.opportunityId === opportunityId
        ? { status: "ready", milestones: result.milestones }
        : { status: "loading" };

  const reload = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  return { state, reload };
}
