"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { Badge } from "@/frontend/components/ui/Badge";
import { Card } from "@/frontend/components/ui/Card";
import { useScenarios } from "@/frontend/hooks/useScenarios";
import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { formatAmount, formatDate } from "@/frontend/lib/format";
import type {
  CashFlowEvent,
  ThpColumnMapping,
  ThpTargetField,
  TreasuryImportBatch,
} from "@/shared/types";

type WizardState =
  | { step: "upload" }
  | { step: "review"; batch: TreasuryImportBatch }
  | { step: "done"; batch: TreasuryImportBatch };

const TARGET_FIELD_LABEL: Record<ThpTargetField, string> = {
  accountCode: "Hesap Kodu",
  accountName: "Hesap Adı",
  balance: "Bakiye",
  dueDate: "Vade Tarihi",
  documentDate: "Belge Tarihi",
  skip: "(Yoksay)",
};

const TARGET_FIELDS: ThpTargetField[] = [
  "accountCode",
  "accountName",
  "balance",
  "dueDate",
  "documentDate",
  "skip",
];

const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const SECONDARY_BUTTON =
  "rounded-md border border-rule px-4 py-2 text-sm transition-colors hover:bg-paper focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";

/**
 * `ImportScreen.tsx`teki AYNI 3 adımlı sihirbaz iskeleti (Yükle -> Eşleştir
 * -> Onayla), THP hesap kodu/tutar/vade sütunları için uyarlanmış. Önizleme
 * satırları HER remap'te sunucuda YENİDEN hesaplanır (bkz.
 * treasury-import.service.ts) — bu yüzden burada da HİÇBİR şey lokalde
 * türetilmez, batch state'i doğrudan sunucu yanıtından gelir.
 */
export function ThpImportWizard() {
  const { state: scenarioState } = useScenarios();
  const scenarios = scenarioState.status === "ready" ? scenarioState.scenarios : [];

  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const effectiveScenarioId = selectedScenarioId || (scenarios[0]?.id ?? "");

  const [file, setFile] = useState<File | null>(null);
  const [wizard, setWizard] = useState<WizardState>({ step: "upload" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [mappingDraft, setMappingDraft] = useState<ThpColumnMapping[]>([]);
  const [remapping, setRemapping] = useState(false);
  const [remapError, setRemapError] = useState<string | null>(null);

  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);

  const handleUpload = useCallback(async () => {
    if (!effectiveScenarioId || !file) return;
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("scenarioId", effectiveScenarioId);
      formData.append("file", file);
      const batch = await apiClient.postForm<TreasuryImportBatch>(
        "/treasury/imports",
        formData,
      );
      setMappingDraft(batch.appliedMapping);
      setWizard({ step: "review", batch });
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Dosya yüklenemedi.");
    } finally {
      setUploading(false);
    }
  }, [effectiveScenarioId, file]);

  const handleApplyMapping = useCallback(async () => {
    if (wizard.step !== "review") return;
    setRemapping(true);
    setRemapError(null);

    try {
      const updated = await apiClient.patch<TreasuryImportBatch>(
        `/treasury/imports/${wizard.batch.id}`,
        { mapping: mappingDraft },
      );
      setWizard({ step: "review", batch: updated });
    } catch (err) {
      setRemapError(err instanceof ApiError ? err.message : "Eşleştirme uygulanamadı.");
    } finally {
      setRemapping(false);
    }
  }, [wizard, mappingDraft]);

  const handleCommit = useCallback(async () => {
    if (wizard.step !== "review") return;
    setCommitting(true);
    setCommitError(null);

    try {
      const result = await apiClient.post<{
        batch: TreasuryImportBatch;
        createdEvents: CashFlowEvent[];
      }>(`/treasury/imports/${wizard.batch.id}/commit`, {});
      setCreatedCount(result.createdEvents.length);
      setWizard({ step: "done", batch: result.batch });
    } catch (err) {
      setCommitError(
        err instanceof ApiError ? err.message : "İçe aktarma onaylanamadı.",
      );
    } finally {
      setCommitting(false);
    }
  }, [wizard]);

  const handleReset = useCallback(() => {
    setWizard({ step: "upload" });
    setFile(null);
    setMappingDraft([]);
    setUploadError(null);
    setCommitError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const issuesByRow = useMemo(() => {
    const map = new Map<number, string[]>();
    if (wizard.step !== "review") return map;
    for (const issue of wizard.batch.issues) {
      const list = map.get(issue.rowNumber) ?? [];
      list.push(issue.message);
      map.set(issue.rowNumber, list);
    }
    return map;
  }, [wizard]);

  const globalIssues = wizard.step === "review" ? (issuesByRow.get(0) ?? []) : [];
  const validRowCount = wizard.step === "review" ? wizard.batch.mappedCount : 0;

  return (
    <>
      {wizard.step === "upload" ? (
        <Card
          title="THP Excel İçe Aktarımı — 1. Dosya Yükle"
          hint="Hesap Kodu, Hesap Adı, Bakiye, Vade Tarihi kolonlarını içeren bir dosya"
        >
          <div className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium text-ink"
                htmlFor="treasury-import-scenario"
              >
                Hedef Senaryo
              </label>
              <select
                id="treasury-import-scenario"
                value={effectiveScenarioId}
                onChange={(e) => setSelectedScenarioId(e.target.value)}
                disabled={scenarios.length === 0}
                className="mt-1 rounded-md border border-rule bg-surface px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none"
              >
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.fiscalYear}){s.isLocked ? " — kilitli" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-medium text-ink"
                htmlFor="treasury-import-file"
              >
                THP Dosyası (.csv, .xlsx, .xls)
              </label>
              <input
                id="treasury-import-file"
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block text-sm text-ink file:mr-3 file:rounded-md file:border file:border-rule file:bg-surface file:px-3 file:py-1.5 file:text-sm hover:file:bg-paper"
              />
            </div>

            {uploadError ? <p className="text-sm text-brick">{uploadError}</p> : null}

            <button
              onClick={handleUpload}
              disabled={!file || !effectiveScenarioId || uploading}
              className={PRIMARY_BUTTON}
            >
              {uploading ? "Yükleniyor…" : "Yükle ve Eşleştir"}
            </button>
          </div>
        </Card>
      ) : null}

      {wizard.step === "review" ? (
        <>
          <Card title="2. Kolon Eşleştirme" hint={wizard.batch.fileName}>
            <div className="space-y-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-xs tracking-wide text-muted uppercase">
                    <th className="pb-2 font-medium">Dosyadaki Kolon</th>
                    <th className="pb-2 font-medium">Karşılığı</th>
                  </tr>
                </thead>
                <tbody>
                  {wizard.batch.detectedColumns.map((column, i) => (
                    <tr key={column} className="border-b border-rule/60 last:border-0">
                      <td className="py-2 font-medium">{column}</td>
                      <td className="py-2">
                        <select
                          value={mappingDraft[i]?.targetField ?? "skip"}
                          onChange={(e) => {
                            const next = [...mappingDraft];
                            next[i] = {
                              sourceColumn: column,
                              targetField: e.target.value as ThpTargetField,
                            };
                            setMappingDraft(next);
                          }}
                          className="rounded-md border border-rule bg-surface px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none"
                        >
                          {TARGET_FIELDS.map((f) => (
                            <option key={f} value={f}>
                              {TARGET_FIELD_LABEL[f]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {remapError ? <p className="text-sm text-brick">{remapError}</p> : null}

              <button
                onClick={handleApplyMapping}
                disabled={remapping}
                className={SECONDARY_BUTTON}
              >
                {remapping ? "Uygulanıyor…" : "Eşleştirmeyi Uygula"}
              </button>
            </div>
          </Card>

          <Card
            title="Önizleme"
            hint={`${wizard.batch.rowCount} satır · ${wizard.batch.mappedCount} nakde yazılacak · ${wizard.batch.skippedCount} atlanacak`}
          >
            {globalIssues.length > 0 ? (
              <div className="mb-4 rounded-md bg-brick-soft px-3 py-2 text-sm text-brick">
                {globalIssues.map((msg) => (
                  <p key={msg}>{msg}</p>
                ))}
              </div>
            ) : null}

            {wizard.batch.rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-rule text-left text-xs tracking-wide text-muted uppercase">
                      <th className="pb-2 font-medium">Satır</th>
                      <th className="pb-2 font-medium">Hesap</th>
                      <th className="pb-2 font-medium">Kategori</th>
                      <th className="pb-2 font-medium">Vade</th>
                      <th className="pb-2 text-right font-medium">Tutar</th>
                      <th className="pb-2 font-medium">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wizard.batch.rows.slice(0, 25).map((row) => (
                      <tr
                        key={row.rowNumber}
                        className="border-b border-rule/60 last:border-0"
                      >
                        <td className="tabular py-2 text-muted">{row.rowNumber}</td>
                        <td className="py-2">
                          {row.accountCode ? (
                            <>
                              {row.accountCode}
                              {row.accountName ? ` — ${row.accountName}` : ""}
                            </>
                          ) : (
                            <span className="text-brick">boş</span>
                          )}
                        </td>
                        <td className="py-2">
                          {row.categoryName ?? (
                            <span className="text-muted">eşleşmedi</span>
                          )}
                        </td>
                        <td className="tabular py-2">
                          {row.dueDate ? (
                            formatDate(row.dueDate)
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td className="tabular py-2 text-right">
                          {row.amount !== null ? (
                            formatAmount(row.amount)
                          ) : (
                            <span className="text-brick">-</span>
                          )}
                        </td>
                        <td className="py-2">
                          {row.mappingConfigId &&
                          row.layer === "CASH" &&
                          row.dueDate ? (
                            <Badge tone="ledger">Nakde Yazılacak</Badge>
                          ) : issuesByRow.has(row.rowNumber) ? (
                            <Badge tone={row.layer === "ACCRUAL" ? "neutral" : "brick"}>
                              {issuesByRow.get(row.rowNumber)!.join(" · ")}
                            </Badge>
                          ) : (
                            <Badge tone="neutral">—</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {wizard.batch.rows.length > 25 ? (
                  <p className="mt-2 text-xs text-muted">
                    +{wizard.batch.rows.length - 25} satır daha (önizlemede
                    gösterilmiyor, hepsi onaylandığında işlenir).
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="py-6 text-sm text-muted">
                Önizlenecek satır yok — yukarıdaki eşleştirmeyi tamamlayıp uygulayın.
              </p>
            )}
          </Card>

          <Card title="3. Onayla">
            <div className="space-y-4">
              <p className="text-sm text-muted">
                <span className="font-medium text-ink">{validRowCount}</span> satır
                nakit olayı olarak yazılacak. Tahakkuk hesapları (600/770 gibi) ve
                vadesi çözümlenemeyen satırlar BİLEREK atlanır.
              </p>

              {commitError ? <p className="text-sm text-brick">{commitError}</p> : null}

              <div className="flex gap-3">
                <button
                  onClick={handleCommit}
                  disabled={committing || validRowCount === 0}
                  className={PRIMARY_BUTTON}
                >
                  {committing ? "Aktarılıyor…" : "Onayla ve İçe Aktar"}
                </button>
                <button onClick={handleReset} className={SECONDARY_BUTTON}>
                  Vazgeç / Başa Dön
                </button>
              </div>
            </div>
          </Card>
        </>
      ) : null}

      {wizard.step === "done" ? (
        <Card title="İçe Aktarma Tamamlandı">
          <div className="space-y-4">
            <p className="text-sm text-ink">
              <Badge tone="ledger">Onaylandı</Badge>{" "}
              <span className="ml-2">
                <span className="font-medium">{wizard.batch.fileName}</span> içinden{" "}
                {createdCount} nakit olayı oluşturuldu.
              </span>
            </p>
            <button onClick={handleReset} className={PRIMARY_BUTTON}>
              Yeni İçe Aktarma
            </button>
          </div>
        </Card>
      ) : null}
    </>
  );
}
