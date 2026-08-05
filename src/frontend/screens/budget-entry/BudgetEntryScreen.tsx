"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";

import { Badge } from "@/frontend/components/ui/Badge";
import { Card } from "@/frontend/components/ui/Card";
import { useBudgetLines } from "@/frontend/hooks/useBudgetLines";
import { useScenarios } from "@/frontend/hooks/useScenarios";
import { useDebouncedCallback } from "@/frontend/lib/use-debounced-callback";
import type { BudgetLineInput } from "@/shared/types";

// AG Grid DOM/ölçüm API'lerine dayanır; sunucuda render edilmemeli.
const BudgetGrid = dynamic(
  () =>
    import("@/frontend/components/budget-grid/BudgetGrid").then((m) => m.BudgetGrid),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] w-full items-center justify-center rounded-md border border-rule text-sm text-muted">
        Tablo yükleniyor…
      </div>
    ),
  },
);

const KIND_LABEL = {
  BUDGET: "Bütçe",
  ACTUAL: "Gerçekleşen",
  FORECAST: "Tahmin",
} as const;

const SAVE_DEBOUNCE_MS = 600;

export function BudgetEntryScreen() {
  const { state: scenarioState } = useScenarios();
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

  const scenarios = scenarioState.status === "ready" ? scenarioState.scenarios : [];
  // Kullanıcı henüz seçim yapmadıysa listedeki ilk senaryo varsayılan olur.
  // Bunu bir effect+setState ile değil, render sırasında türeterek yapıyoruz.
  const effectiveScenarioId = selectedScenarioId ?? scenarios[0]?.id ?? null;

  const { sheetState, saveStatus, save } = useBudgetLines(effectiveScenarioId);

  // Art arda gelen hücre değişikliklerini (aynı hücreye yapılan tekrar
  // düzenlemeler dahil) birleştirip tek istekte kaydeder.
  const pendingRef = useRef<Map<string, BudgetLineInput>>(new Map());
  const flush = useDebouncedCallback((scenarioId: string) => {
    const lines = [...pendingRef.current.values()];
    pendingRef.current.clear();
    if (lines.length > 0) void save(scenarioId, lines);
  }, SAVE_DEBOUNCE_MS);

  const handleCellsChanged = useCallback(
    (changed: BudgetLineInput[]) => {
      if (!effectiveScenarioId) return;
      for (const line of changed) {
        pendingRef.current.set(`${line.categoryId}:${line.month}`, line);
      }
      flush(effectiveScenarioId);
    },
    [effectiveScenarioId, flush],
  );

  const selectedScenario = scenarios.find((s) => s.id === effectiveScenarioId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bütçe Girişi</h1>
        <p className="mt-1 text-sm text-muted">
          Ay hücrelerini tek tek doldurun (aşağıdan yukarıya) veya bir satırın{" "}
          <span className="font-medium text-ink">Yıllık Toplam</span> hücresine yıllık
          rakamı yazın (yukarıdan aşağıya) — 12 aya otomatik dağıtılır. Excel&apos;den
          kopyaladığınız bir bloğu, odaklandığınız hücreden başlayarak doğrudan
          yapıştırabilirsiniz.
        </p>
      </div>

      <Card
        title="Senaryo"
        hint={selectedScenario ? `Mali yıl ${selectedScenario.fiscalYear}` : undefined}
      >
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={effectiveScenarioId ?? ""}
            onChange={(e) => setSelectedScenarioId(e.target.value)}
            disabled={scenarios.length === 0}
            className="rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none"
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {KIND_LABEL[s.kind]}
              </option>
            ))}
          </select>

          {selectedScenario ? (
            <Badge tone={selectedScenario.isLocked ? "brick" : "ledger"}>
              {selectedScenario.isLocked
                ? "Kilitli — salt okunur"
                : "Açık — düzenlenebilir"}
            </Badge>
          ) : null}

          <span className="ml-auto text-xs">
            {saveStatus.status === "saving" ? (
              <span className="text-muted">Kaydediliyor…</span>
            ) : null}
            {saveStatus.status === "saved" ? (
              <span className="text-ledger">Kaydedildi</span>
            ) : null}
            {saveStatus.status === "error" ? (
              <span className="text-brick">{saveStatus.message}</span>
            ) : null}
          </span>
        </div>
      </Card>

      <Card title="Kategori × Ay" hint={selectedScenario?.baseCurrency}>
        {sheetState.status === "loading" || !effectiveScenarioId ? (
          <p className="py-6 text-sm text-muted">Bütçe tablosu yükleniyor…</p>
        ) : null}

        {sheetState.status === "error" ? (
          <p className="py-6 text-sm text-brick">{sheetState.message}</p>
        ) : null}

        {sheetState.status === "ready" && selectedScenario ? (
          <BudgetGrid
            key={selectedScenario.id}
            categories={sheetState.sheet.categories}
            lines={sheetState.sheet.lines}
            editable={!selectedScenario.isLocked}
            onCellsChanged={handleCellsChanged}
          />
        ) : null}
      </Card>
    </div>
  );
}
