"use client";

import { useSalesOpportunities } from "@/frontend/hooks/useSalesOpportunities";
import { useSalesStageConfig } from "@/frontend/hooks/useSalesStageConfig";
import type { Role } from "@/shared/types";

import { SalesActualsPostPanel } from "./SalesActualsPostPanel";
import { SalesOpportunityListPanel } from "./SalesOpportunityListPanel";
import { SalesPipelineForecastPostPanel } from "./SalesPipelineForecastPostPanel";

// UX amaçlıdır — AppShell.tsx'teki nav filtresiyle AYNI mantık. Asıl yetki
// sınırı backend'de `sales-opportunity:commit` izni (bkz. authorize.ts); bu
// satır olmasa bile DATA_ENTRY /api/sales-opportunities/actuals-commit ve
// /pipeline-forecast-commit uçlarında 403 alır.
const CAN_COMMIT_ROLES: Role[] = ["ADMIN", "BUDGET_MANAGER"];

/**
 * Satış ekranı — `FixedAssetsScreen`'in AKSİNE onay akışı YOK: fırsat
 * listesi + ekleme/kapatma HER ÜÇ role açık (rutin CRM veri girişi, bkz.
 * authorize.ts'teki sales-opportunity:write notu). Sadece bütçeye yazma
 * (actuals/pipeline forecast commit) SADECE ADMIN/BÜTÇE Yöneticisi'ne gösterilir.
 */
export function SalesScreen({ role }: { role: Role }) {
  const { state: opportunitiesState, reload: reloadOpportunities } =
    useSalesOpportunities();
  const { state: stageConfigState } = useSalesStageConfig();
  const canCommit = CAN_COMMIT_ROLES.includes(role);

  const stageConfig =
    stageConfigState.status === "ready" ? stageConfigState.entries : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Satış</h1>
        <p className="mt-1 text-sm text-muted">
          Satış fırsatları (pipeline). Kazanılan (WON) fırsatlar gerçek kapanış ayına
          tam tutarıyla, açık fırsatlar beklenen kapanış ayına kazanma olasılığıyla
          ağırlıklandırılmış tutarıyla &quot;Gelir&quot; kategorisine yazılabilir.
        </p>
      </div>

      {opportunitiesState.status === "loading" ? (
        <p className="text-sm text-muted">Yükleniyor…</p>
      ) : null}
      {opportunitiesState.status === "error" ? (
        <p className="text-sm text-brick">{opportunitiesState.message}</p>
      ) : null}

      {opportunitiesState.status === "ready" ? (
        <SalesOpportunityListPanel
          opportunities={opportunitiesState.opportunities}
          stageConfig={stageConfig}
          onChanged={reloadOpportunities}
        />
      ) : null}

      {canCommit ? <SalesActualsPostPanel /> : null}
      {canCommit ? <SalesPipelineForecastPostPanel /> : null}
    </div>
  );
}
