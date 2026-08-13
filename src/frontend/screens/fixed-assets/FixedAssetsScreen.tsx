"use client";

import { useState } from "react";

import { useFixedAssets } from "@/frontend/hooks/useFixedAssets";
import { useVukAmortismanConfig } from "@/frontend/hooks/useVukAmortismanConfig";
import type { Role } from "@/shared/types";

import { ApprovalQueuePanel } from "./ApprovalQueuePanel";
import { DepreciationPostPanel } from "./DepreciationPostPanel";
import { DepreciationSchedulePanel } from "./DepreciationSchedulePanel";
import { FeasibilityPanel } from "./FeasibilityPanel";
import { FixedAssetListPanel } from "./FixedAssetListPanel";

// UX amaçlıdır — AppShell.tsx'teki nav filtresiyle AYNI mantık. Asıl yetki
// sınırı backend'de `fixed-asset:approve` izni (bkz. authorize.ts); bu satır
// olmasa bile DATA_ENTRY /api/fixed-assets/*/approve|reject ve
// /api/fixed-assets/depreciation-commit uçlarında 403 alır.
const CAN_APPROVE_ROLES: Role[] = ["ADMIN", "BUDGET_MANAGER"];

/**
 * Sabit Kıymetler ekranı — TÜM roller erişebilir (Personel'in aksine SADECE
 * ADMIN değil), ama Onay Kuyruğu ve Amortismanı Bütçeye Yaz bölümleri SADECE
 * ADMIN/BÜTÇE YÖNETİCİSİ'ne gösterilir. Beş bölüm: sabit kıymet listesi +
 * ekleme, seçili varlığın fizibilitesi (NPV/IRR) ve amortisman programı
 * (herhangi bir durumda görünür), onay kuyruğu, amortismanı bütçeye yazma
 * (senaryo bazlı, tekrar çalıştırılabilir).
 */
export function FixedAssetsScreen({ role }: { role: Role }) {
  const { state: assetsState, reload: reloadAssets } = useFixedAssets();
  const { state: vukConfigState } = useVukAmortismanConfig();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const canApprove = CAN_APPROVE_ROLES.includes(role);

  const assets = assetsState.status === "ready" ? assetsState.assets : [];
  const vukConfig = vukConfigState.status === "ready" ? vukConfigState.entries : [];
  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Sabit Kıymetler</h1>
        <p className="mt-1 text-sm text-muted">
          VUK/TDHP kıst amortisman motoru ve fizibilite (NPV/IRR) analizi. Onaylanan
          sabit kıymetlerin amortismanı, senaryo bazında &quot;Bütçeye Yaz&quot; ile
          &quot;Amortisman Giderleri&quot; kategorisine yazılır.
        </p>
      </div>

      {assetsState.status === "loading" ? (
        <p className="text-sm text-muted">Yükleniyor…</p>
      ) : null}
      {assetsState.status === "error" ? (
        <p className="text-sm text-brick">{assetsState.message}</p>
      ) : null}

      {assetsState.status === "ready" ? (
        <FixedAssetListPanel
          assets={assets}
          vukConfig={vukConfig}
          selectedId={selectedAssetId}
          onSelect={setSelectedAssetId}
          onCreated={reloadAssets}
          onSubmitted={reloadAssets}
        />
      ) : null}

      {selectedAsset ? (
        <>
          <FeasibilityPanel asset={selectedAsset} />
          <DepreciationSchedulePanel asset={selectedAsset} />
        </>
      ) : null}

      {canApprove ? <ApprovalQueuePanel onDecided={reloadAssets} /> : null}
      {canApprove ? <DepreciationPostPanel /> : null}
    </div>
  );
}
