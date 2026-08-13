"use client";

import { Badge } from "@/frontend/components/ui/Badge";
import { Card } from "@/frontend/components/ui/Card";
import { useAuditLogs } from "@/frontend/hooks/useAuditLogs";
import { formatAmount, formatDateTime } from "@/frontend/lib/format";
import type { AuditAction, AuditSource } from "@/shared/types";

const SOURCE_LABEL: Record<AuditSource, string> = {
  MANUAL_EDIT: "Manuel Giriş",
  FORECAST: "Forecast",
  IMPORT: "İçe Aktarma",
  PAYROLL: "Bordro",
  EXPENSE: "Gider Merkezi",
  DEPRECIATION: "Amortisman",
};

const SOURCE_TONE: Record<AuditSource, "neutral" | "ledger" | "brick"> = {
  MANUAL_EDIT: "neutral",
  FORECAST: "ledger",
  IMPORT: "brick",
  PAYROLL: "ledger",
  EXPENSE: "ledger",
  DEPRECIATION: "ledger",
};

const ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: "Yeni",
  UPDATE: "Güncelleme",
};

export function AuditLogScreen() {
  const { state, reload } = useAuditLogs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Denetim Kaydı</h1>
        <p className="mt-1 text-sm text-muted">
          Bütçe hücrelerinde yapılan HER değişiklik — kimin, ne zaman, hangi hücreyi,
          eski hangi değerden yeni hangi değere getirdiği — burada değiştirilemez
          biçimde tutulur. Manuel düzenleme, forecast ve içe aktarma (import)
          commit&apos;i dahil her yol aynı kaydı üretir. Sadece Admin ve Bütçe
          Yöneticisi görebilir.
        </p>
      </div>

      <Card
        title="Hücre değişiklikleri"
        hint={state.status === "ready" ? `${state.entries.length} kayıt` : undefined}
      >
        {state.status === "loading" ? (
          <p className="py-6 text-sm text-muted">Denetim kaydı yükleniyor…</p>
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

        {state.status === "ready" && state.entries.length === 0 ? (
          <p className="py-6 text-sm text-muted">
            Henüz kaydedilmiş bir değişiklik yok.
          </p>
        ) : null}

        {state.status === "ready" && state.entries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs tracking-wide text-muted uppercase">
                  <th className="pb-2 font-medium">Zaman</th>
                  <th className="pb-2 font-medium">Kullanıcı</th>
                  <th className="pb-2 font-medium">Senaryo</th>
                  <th className="pb-2 font-medium">Kategori / Ay</th>
                  <th className="pb-2 text-right font-medium">Eski Değer</th>
                  <th className="pb-2 text-right font-medium">Yeni Değer</th>
                  <th className="pb-2 text-right font-medium">Kaynak</th>
                </tr>
              </thead>
              <tbody>
                {state.entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-rule/60 last:border-0">
                    <td className="tabular py-3 text-muted">
                      {formatDateTime(entry.occurredAt)}
                    </td>
                    <td className="py-3 font-medium">{entry.userName}</td>
                    <td className="py-3 text-muted">{entry.scenarioName}</td>
                    <td className="py-3">
                      {entry.categoryName}{" "}
                      <span className="text-muted">
                        · Ay {entry.month} · {ACTION_LABEL[entry.action]}
                      </span>
                    </td>
                    <td className="tabular py-3 text-right text-muted">
                      {formatAmount(entry.oldValue)}
                    </td>
                    <td className="tabular py-3 text-right font-medium">
                      {formatAmount(entry.newValue)}
                    </td>
                    <td className="py-3 text-right">
                      <Badge tone={SOURCE_TONE[entry.source]}>
                        {SOURCE_LABEL[entry.source]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
