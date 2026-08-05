"use client";

import { Badge } from "@/frontend/components/ui/Badge";
import { Card } from "@/frontend/components/ui/Card";
import { useScenarios } from "@/frontend/hooks/useScenarios";
import { formatDate } from "@/frontend/lib/format";

const KIND_LABEL = {
  BUDGET: "Bütçe",
  ACTUAL: "Gerçekleşen",
  FORECAST: "Tahmin",
} as const;

export function ScenariosScreen() {
  const { state, reload } = useScenarios();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Senaryolar</h1>
        <p className="mt-1 text-sm text-muted">
          Bu liste <code className="tabular text-ink">GET /api/scenarios</code> ucundan
          geliyor. Veri backend katmanından geçtiği için ekran kodunda tek bir iş kuralı
          yok.
        </p>
      </div>

      <Card title="Kayıtlı senaryolar" hint="demo-tenant">
        {state.status === "loading" ? (
          <p className="py-6 text-sm text-muted">Senaryolar yükleniyor…</p>
        ) : null}

        {state.status === "error" ? (
          <div className="py-6">
            <p className="text-sm text-brick">{state.message}</p>
            <button
              onClick={reload}
              className="mt-3 rounded-md border border-rule px-3 py-1.5 text-sm transition-colors hover:bg-paper focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none"
            >
              Tekrar dene
            </button>
          </div>
        ) : null}

        {state.status === "ready" ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-xs tracking-wide text-muted uppercase">
                <th className="pb-2 font-medium">Senaryo</th>
                <th className="pb-2 font-medium">Tür</th>
                <th className="pb-2 text-right font-medium">Mali Yıl</th>
                <th className="pb-2 text-right font-medium">Durum</th>
                <th className="pb-2 text-right font-medium">Güncelleme</th>
              </tr>
            </thead>
            <tbody>
              {state.scenarios.map((scenario) => (
                <tr key={scenario.id} className="border-b border-rule/60 last:border-0">
                  <td className="py-3 font-medium">{scenario.name}</td>
                  <td className="py-3 text-muted">{KIND_LABEL[scenario.kind]}</td>
                  <td className="tabular py-3 text-right">{scenario.fiscalYear}</td>
                  <td className="py-3 text-right">
                    <Badge tone={scenario.isLocked ? "brick" : "ledger"}>
                      {scenario.isLocked ? "Kilitli" : "Açık"}
                    </Badge>
                  </td>
                  <td className="tabular py-3 text-right text-muted">
                    {formatDate(scenario.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </Card>
    </div>
  );
}
