"use client";

import { useState } from "react";

import { Card } from "@/frontend/components/ui/Card";
import { useCostCenters } from "@/frontend/hooks/useCostCenters";
import { useScenarios } from "@/frontend/hooks/useScenarios";
import type { Role } from "@/shared/types";

import { AllocationKeyPanel } from "./AllocationKeyPanel";
import { ApprovalQueuePanel } from "./ApprovalQueuePanel";
import { CostCenterTree, NewCostCenterForm } from "./CostCenterTree";
import { ExpenseAllocationReportPanel } from "./ExpenseAllocationReportPanel";
import { ExpenseEntriesPanel, useExpenseCategories } from "./ExpenseEntriesPanel";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";

// UX amaçlıdır — AppShell.tsx'teki nav filtresiyle AYNI mantık. Asıl yetki
// sınırı backend'de `expense-entry:approve` izni (bkz. authorize.ts); bu
// satır olmasa bile DATA_ENTRY /api/expense-entries/*/approve|reject ve
// /api/expense-entries/commit uçlarında 403 alır.
const CAN_APPROVE_ROLES: Role[] = ["ADMIN", "BUDGET_MANAGER"];

/**
 * Gider Merkezleri ekranı — TÜM roller erişebilir (Personel'in aksine SADECE
 * ADMIN değil), ama Onay Kuyruğu SADECE ADMIN/BÜTÇE YÖNETİCİSİ'ne gösterilir
 * (bkz. `CAN_APPROVE_ROLES`). Dört bölüm: gider merkezi hiyerarşisi + tahsis
 * anahtarı, gider kayıtları (taslak/onaya gönder), onay kuyruğu (onayla/
 * reddet/bütçeye yaz — sadece yetkili roller), tahsis raporu (salt okunur).
 */
export function CostCentersScreen({ role }: { role: Role }) {
  const { state: costCentersState, reload: reloadCostCenters } = useCostCenters();
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string | null>(null);
  const { state: scenariosState } = useScenarios();
  const [scenarioId, setScenarioId] = useState("");

  const costCenters =
    costCentersState.status === "ready" ? costCentersState.costCenters : [];
  const selectedCostCenter =
    costCenters.find((cc) => cc.id === selectedCostCenterId) ?? null;
  const categories = useExpenseCategories(scenarioId || null);
  const canApprove = CAN_APPROVE_ROLES.includes(role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Gider Merkezleri</h1>
        <p className="mt-1 text-sm text-muted">
          Departman hiyerarşisi, paylaşılan maliyetlerin tahsis anahtarlarıyla
          dağıtılması ve gider kayıtlarının onay akışı. Onaylanan kayıtlar &quot;Bütçeye
          Yaz&quot; ile senaryonun ilgili kategori/ay hücrelerine yazılır.
        </p>
      </div>

      <Card
        title="Gider Merkezi Hiyerarşisi"
        hint={
          costCentersState.status === "ready"
            ? `${costCenters.length} kayıt`
            : undefined
        }
      >
        {costCentersState.status === "loading" ? (
          <p className="text-sm text-muted">Yükleniyor…</p>
        ) : null}
        {costCentersState.status === "error" ? (
          <p className="text-sm text-brick">{costCentersState.message}</p>
        ) : null}
        {costCentersState.status === "ready" ? (
          <CostCenterTree
            costCenters={costCenters}
            selectedId={selectedCostCenterId}
            onSelect={setSelectedCostCenterId}
          />
        ) : null}

        <NewCostCenterForm costCenters={costCenters} onCreated={reloadCostCenters} />
      </Card>

      {selectedCostCenter ? (
        <AllocationKeyPanel
          costCenter={selectedCostCenter}
          allCostCenters={costCenters}
        />
      ) : null}

      <Card
        title="Senaryo Seçimi"
        hint="Gider kayıtları ve onay akışı bir senaryoya bağlıdır."
      >
        <select
          value={scenarioId}
          onChange={(e) => setScenarioId(e.target.value)}
          className={INPUT_CLASS}
        >
          <option value="">Seçin…</option>
          {scenariosState.status === "ready"
            ? scenariosState.scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.fiscalYear})
                </option>
              ))
            : null}
        </select>
      </Card>

      {scenarioId ? (
        <>
          <ExpenseEntriesPanel
            scenarioId={scenarioId}
            costCenters={costCenters}
            categories={categories}
          />
          {canApprove ? (
            <ApprovalQueuePanel scenarioId={scenarioId} costCenters={costCenters} />
          ) : null}
          <ExpenseAllocationReportPanel
            scenarioId={scenarioId}
            costCenters={costCenters}
            categories={categories}
          />
        </>
      ) : null}
    </div>
  );
}
