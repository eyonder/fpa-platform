"use client";

import { useState } from "react";

import { Card } from "@/frontend/components/ui/Card";
import { useAllocationKey } from "@/frontend/hooks/useAllocationKey";
import { apiClient, ApiError } from "@/frontend/lib/api-client";
import type { AllocationKeyMember, CostCenter } from "@/shared/types";

const INPUT_CLASS =
  "mt-1 w-full rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const SECONDARY_BUTTON =
  "rounded-md border border-rule px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";

/**
 * Seçili gider merkezini KAYNAK alan bir tahsis anahtarını gösterir/düzenler.
 * Kaydetme, %100'e ulaşana kadar devre dışıdır (bkz. backend'deki AYNI kural:
 * `upsertAllocationKeySchema`'nın `.refine`i). Bu SADECE raporlama amaçlıdır —
 * kaydetmek bütçeye yazılan hiçbir tutarı DEĞİŞTİRMEZ (bkz. hint metni).
 */
export function AllocationKeyPanel({
  costCenter,
  allCostCenters,
}: {
  costCenter: CostCenter;
  allCostCenters: CostCenter[];
}) {
  const { state, reload } = useAllocationKey(costCenter.id);
  const [name, setName] = useState("");
  const [members, setMembers] = useState<AllocationKeyMember[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Render sırasında (effect İÇİNDE DEĞİL) sıfırlama — `PersonnelScreen.tsx`teki
  // `CompensationPanel`in AYNI deseni: seçili gider merkezi değişince form
  // alanları YENİ anahtarın verisiyle bir sonraki render'dan ÖNCE eşitlenir.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (state.status === "ready" && loadedFor !== costCenter.id) {
    setLoadedFor(costCenter.id);
    setName(state.key?.name ?? `${costCenter.name} Tahsis Anahtarı`);
    setMembers(state.key?.members ?? []);
  }

  const candidateMembers = allCostCenters.filter((cc) => cc.id !== costCenter.id);
  const total = members.reduce((sum, m) => sum + (m.weightPercent || 0), 0);
  const totalOk = Math.abs(total - 100) <= 0.01;

  const addMemberRow = () => {
    const next = candidateMembers.find(
      (cc) => !members.some((m) => m.costCenterId === cc.id),
    );
    if (!next) return;
    setMembers((prev) => [...prev, { costCenterId: next.id, weightPercent: 0 }]);
  };

  const updateMember = (index: number, patch: Partial<AllocationKeyMember>) => {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const removeMember = (index: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/cost-centers/${costCenter.id}/allocation-key`, {
        name,
        members,
      });
      reload();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Tahsis anahtarı kaydedilemedi.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card
      title={`Tahsis Anahtarı — ${costCenter.name}`}
      hint="Sadece raporlama içindir; bütçeye yazılan kategori/ay toplamını değiştirmez."
    >
      {state.status === "loading" ? (
        <p className="text-sm text-muted">Yükleniyor…</p>
      ) : null}
      {state.status === "error" ? (
        <p className="text-sm text-brick">{state.message}</p>
      ) : null}

      {state.status === "ready" ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-ink">Anahtar Adı</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          {members.length === 0 ? (
            <p className="text-sm text-muted">
              Bu gider merkezi için henüz üye tanımlanmadı — maliyeti başka merkezlere
              dağıtmak için üye ekleyin.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-muted">
                  <th className="py-2 pr-3">Üye Gider Merkezi</th>
                  <th className="py-2 pr-3">Ağırlık (%)</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={i} className="border-b border-rule last:border-0">
                    <td className="py-2 pr-3">
                      <select
                        value={m.costCenterId}
                        onChange={(e) =>
                          updateMember(i, { costCenterId: e.target.value })
                        }
                        className={INPUT_CLASS}
                      >
                        {candidateMembers.map((cc) => (
                          <option key={cc.id} value={cc.id}>
                            {cc.code} — {cc.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={m.weightPercent}
                        onChange={(e) =>
                          updateMember(i, { weightPercent: Number(e.target.value) })
                        }
                        className={INPUT_CLASS}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => removeMember(i)}
                        className={SECONDARY_BUTTON}
                      >
                        Kaldır
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={addMemberRow}
              disabled={
                candidateMembers.length === 0 ||
                members.length >= candidateMembers.length
              }
              className={SECONDARY_BUTTON}
            >
              + Üye Ekle
            </button>
            <p
              className={`tabular text-sm font-medium ${totalOk ? "text-ledger" : "text-brick"}`}
            >
              Toplam: %{total.toFixed(2)}
            </p>
          </div>

          {error ? <p className="text-sm text-brick">{error}</p> : null}

          <button
            type="button"
            onClick={handleSave}
            disabled={submitting || members.length === 0 || !totalOk}
            className={PRIMARY_BUTTON}
          >
            {submitting ? "Kaydediliyor…" : "Anahtarı Kaydet"}
          </button>
        </div>
      ) : null}
    </Card>
  );
}
