"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { useDisplayCurrency } from "@/frontend/lib/display-currency";
import type { BudgetLineInput, BudgetSheet } from "@/shared/types";

type SheetState =
  | { status: "loading" }
  | { status: "ready"; sheet: BudgetSheet }
  | { status: "error"; message: string };

export type SaveStatus =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string };

function toMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** Bir senaryonun bütçe tablosunu getirir ve hücre değişikliklerini kaydeder. */
export function useBudgetLines(scenarioId: string | null) {
  const { queryValue: displayCurrency } = useDisplayCurrency();
  const [sheet, setSheet] = useState<BudgetSheet | null>(null);
  const [error, setError] = useState<{ scenarioId: string; message: string } | null>(
    null,
  );

  useEffect(() => {
    if (!scenarioId) return;

    const controller = new AbortController();

    const currencyParam = displayCurrency
      ? `&displayCurrency=${encodeURIComponent(displayCurrency)}`
      : "";

    apiClient
      .get<BudgetSheet>(
        `/budget-lines?scenarioId=${encodeURIComponent(scenarioId)}${currencyParam}`,
        { signal: controller.signal },
      )
      .then((result) => {
        if (controller.signal.aborted) return;
        setSheet(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError({ scenarioId, message: toMessage(err, "Bütçe tablosu yüklenemedi.") });
      });

    return () => controller.abort();
  }, [scenarioId, displayCurrency]);

  // "loading" render sırasında türetilir (effect içinde setState yerine):
  // istenen scenarioId'ye ait ne bir sonuç ne de bir hata varsa yükleniyordur.
  const sheetState: SheetState = !scenarioId
    ? { status: "loading" }
    : error?.scenarioId === scenarioId
      ? { status: "error", message: error.message }
      : sheet?.scenarioId === scenarioId
        ? { status: "ready", sheet }
        : { status: "loading" };

  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ status: "idle" });

  // Yarışan kayıt isteklerinde ekranda sadece EN SON isteğin sonucu görünsün.
  const saveAttemptRef = useRef(0);

  const save = useCallback(
    async (targetScenarioId: string, lines: BudgetLineInput[]) => {
      const attempt = ++saveAttemptRef.current;
      setSaveStatus({ status: "saving" });

      try {
        await apiClient.post("/budget-lines", { scenarioId: targetScenarioId, lines });
        if (saveAttemptRef.current === attempt) setSaveStatus({ status: "saved" });
      } catch (err) {
        if (saveAttemptRef.current === attempt) {
          setSaveStatus({ status: "error", message: toMessage(err, "Kaydedilemedi.") });
        }
      }
    },
    [],
  );

  return { sheetState, saveStatus, save };
}
