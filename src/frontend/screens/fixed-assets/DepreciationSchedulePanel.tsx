"use client";

import { Card } from "@/frontend/components/ui/Card";
import { useFixedAssetSchedule } from "@/frontend/hooks/useFixedAssetSchedule";
import { formatAmount } from "@/frontend/lib/format";
import type { FixedAsset } from "@/shared/types";

/** Salt okunur: VUK kıst amortisman programının TAMAMI, HER istekte
 * yeniden üretilir (bkz. fixed-asset.service.ts#schedule). */
export function DepreciationSchedulePanel({ asset }: { asset: FixedAsset }) {
  const { state } = useFixedAssetSchedule(asset.id);

  return (
    <Card
      title={`Amortisman Programı — ${asset.assetName}`}
      hint={state.status === "ready" ? `${state.months.length} ay` : undefined}
    >
      {state.status === "loading" ? (
        <p className="text-sm text-muted">Yükleniyor…</p>
      ) : null}
      {state.status === "error" ? (
        <p className="text-sm text-brick">{state.message}</p>
      ) : null}

      {state.status === "ready" ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-ink">
            Ay ay dökümü ({state.months.length} ay)
          </summary>
          <table className="tabular mt-2 w-full text-xs">
            <thead>
              <tr className="border-b border-rule text-left text-muted">
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">Yıl</th>
                <th className="py-1 pr-2">Ay</th>
                <th className="py-1 pr-2">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {state.months.map((m) => (
                <tr
                  key={m.sequenceNumber}
                  className="border-b border-rule last:border-0"
                >
                  <td className="py-1 pr-2">{m.sequenceNumber}</td>
                  <td className="py-1 pr-2">{m.year}</td>
                  <td className="py-1 pr-2">{m.month}</td>
                  <td className="py-1 pr-2">{formatAmount(m.amount, "TRY")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </Card>
  );
}
