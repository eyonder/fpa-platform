"use client";

import { useState } from "react";

import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { CostCenter } from "@/shared/types";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const SECONDARY_BUTTON =
  "rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";

/**
 * Basit, özyinelemeli (recursive) girintili liste — uygulamada başka bir
 * ağaç/hiyerarşi bileşeni YOK (AG Grid `treeData` da kullanılmıyor), bu
 * yüzden en basit çözüm tercih edildi: `organization.repository.ts`teki
 * "uygulama tarafında gez" felsefesinin arayüz karşılığı.
 */
export function CostCenterTree({
  costCenters,
  selectedId,
  onSelect,
}: {
  costCenters: CostCenter[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (costCenters.length === 0) {
    return <p className="text-sm text-muted">Henüz gider merkezi eklenmedi.</p>;
  }

  const byParent = new Map<string | null, CostCenter[]>();
  for (const cc of costCenters) {
    const key = cc.parentCostCenterId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(cc);
  }

  return (
    <ul className="space-y-1 text-sm">
      <TreeLevel
        byParent={byParent}
        parentId={null}
        depth={0}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    </ul>
  );
}

function TreeLevel({
  byParent,
  parentId,
  depth,
  selectedId,
  onSelect,
}: {
  byParent: Map<string | null, CostCenter[]>;
  parentId: string | null;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const children = byParent.get(parentId) ?? [];
  if (children.length === 0) return null;

  return (
    <>
      {children.map((cc) => (
        <li key={cc.id}>
          <button
            type="button"
            onClick={() => onSelect(cc.id)}
            style={{ paddingLeft: `${depth * 1.25}rem` }}
            className={`tabular flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-paper ${
              selectedId === cc.id ? "bg-ledger-soft text-ledger" : "text-ink"
            }`}
          >
            <span className="text-xs text-muted">{cc.code}</span>
            <span className="font-medium">{cc.name}</span>
          </button>
          <ul>
            <TreeLevel
              byParent={byParent}
              parentId={cc.id}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          </ul>
        </li>
      ))}
    </>
  );
}

export function NewCostCenterForm({
  costCenters,
  onCreated,
}: {
  costCenters: CostCenter[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [parentCostCenterId, setParentCostCenterId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${SECONDARY_BUTTON} mt-4`}
      >
        + Yeni Gider Merkezi
      </button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/cost-centers", {
        code,
        name,
        parentCostCenterId: parentCostCenterId || undefined,
      });
      setCode("");
      setName("");
      setParentCostCenterId("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gider merkezi eklenemedi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-md bg-paper p-4">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-ink">Kod</label>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={INPUT_CLASS}
            placeholder="ör. BT"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Ad</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink">Üst Merkez</label>
          <select
            value={parentCostCenterId}
            onChange={(e) => setParentCostCenterId(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Yok (kök)</option>
            {costCenters.map((cc) => (
              <option key={cc.id} value={cc.id}>
                {cc.code} — {cc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="text-sm text-brick">{error}</p> : null}

      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className={PRIMARY_BUTTON}>
          {submitting ? "Ekleniyor…" : "Ekle"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={SECONDARY_BUTTON}
        >
          Vazgeç
        </button>
      </div>
    </form>
  );
}
