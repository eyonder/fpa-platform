"use client";

import { useCallback, useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { useDisplayCurrency } from "@/frontend/lib/display-currency";
import type {
  IncludeDerivedSources,
  TreasuryAdjustment,
  TreasuryProjection,
} from "@/shared/types";

/**
 * What-If çalıştırıcı. `useTreasuryProjection`in AKSİNE bir EFEKT hook'u
 * DEĞİL, bir EYLEM hook'udur: kullanıcı butona basmadan istek gitmez —
 * simülasyon sunucuda gerçek bir hesaplama başlatır ve otomatik tetiklenmesi
 * hem pahalı hem de anlamsız olurdu.
 *
 * Sonuç EPHEMERAL'dir: burada tutulur, hiçbir yere kaydedilmez.
 */
export function useTreasurySimulation() {
  const { queryValue: displayCurrency } = useDisplayCurrency();
  const [result, setResult] = useState<TreasuryProjection | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (input: {
      scenarioId: string;
      horizonDays: number;
      granularity: "DAY" | "WEEK";
      includeDerived: IncludeDerivedSources;
      adjustments: TreasuryAdjustment[];
    }) => {
      setRunning(true);
      setError(null);
      try {
        const projection = await apiClient.post<TreasuryProjection>(
          "/treasury/simulate",
          { ...input, displayCurrency },
        );
        setResult(projection);
        return projection;
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Simülasyon çalıştırılamadı.");
        return null;
      } finally {
        setRunning(false);
      }
    },
    [displayCurrency],
  );

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, running, error, run, clear };
}
