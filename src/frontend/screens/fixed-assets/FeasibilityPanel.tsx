"use client";

import { Card } from "@/frontend/components/ui/Card";
import { useFixedAssetFeasibility } from "@/frontend/hooks/useFixedAssetFeasibility";
import { formatAmount } from "@/frontend/lib/format";
import type { FixedAsset } from "@/shared/types";

/** NPV/IRR HER istekte yeniden hesaplanır, hiçbir yerde saklanmaz — herhangi
 * bir durumda (DRAFT dahil) görüntülenebilir: talep eden taslak hazırlarken,
 * onaylayan karar verirken görür (bkz. fixed-asset.service.ts#feasibility). */
export function FeasibilityPanel({ asset }: { asset: FixedAsset }) {
  const { state } = useFixedAssetFeasibility(asset.id);

  return (
    <Card
      title={`Fizibilite — ${asset.assetName}`}
      hint={`İskonto oranı: %${(asset.discountRate * 100).toFixed(2)}`}
    >
      {state.status === "loading" ? (
        <p className="text-sm text-muted">Hesaplanıyor…</p>
      ) : null}
      {state.status === "error" ? (
        <p className="text-sm text-brick">{state.message}</p>
      ) : null}

      {state.status === "ready" ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted">Net Bugünkü Değer (NPV)</p>
            <p
              className={`tabular text-lg font-semibold ${
                state.feasibility.npv >= 0 ? "text-ledger" : "text-brick"
              }`}
            >
              {formatAmount(state.feasibility.npv, "TRY")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">İç Verim Oranı (IRR)</p>
            <p className="tabular text-lg font-semibold text-ink">
              {state.feasibility.irr !== null
                ? `%${(state.feasibility.irr * 100).toFixed(2)}`
                : "Hesaplanamadı"}
            </p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
