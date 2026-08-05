"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

import { Badge } from "@/frontend/components/ui/Badge";
import { Card } from "@/frontend/components/ui/Card";
import { useScenarios } from "@/frontend/hooks/useScenarios";
import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { formatAmount } from "@/frontend/lib/format";
import type {
  BudgetLine,
  ImportBatch,
  ImportColumnMapping,
  ImportTargetField,
} from "@/shared/types";

type WizardState =
  | { step: "upload" }
  | { step: "review"; batch: ImportBatch }
  | { step: "done"; batch: ImportBatch };

const TARGET_FIELD_LABEL: Record<ImportTargetField, string> = {
  categoryId: "Kategori",
  month: "Ay",
  amount: "Tutar",
  skip: "(Yoksay)",
};

const TARGET_FIELDS: ImportTargetField[] = ["categoryId", "month", "amount", "skip"];

const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const SECONDARY_BUTTON =
  "rounded-md border border-rule px-4 py-2 text-sm transition-colors hover:bg-paper focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";

export function ImportScreen() {
  const { state: scenarioState } = useScenarios();
  const scenarios = scenarioState.status === "ready" ? scenarioState.scenarios : [];

  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const effectiveScenarioId = selectedScenarioId || (scenarios[0]?.id ?? "");

  const [file, setFile] = useState<File | null>(null);
  const [wizard, setWizard] = useState<WizardState>({ step: "upload" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [mappingDraft, setMappingDraft] = useState<ImportColumnMapping[]>([]);
  const [remapping, setRemapping] = useState(false);
  const [remapError, setRemapError] = useState<string | null>(null);

  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [committedCount, setCommittedCount] = useState(0);

  const handleUpload = useCallback(async () => {
    if (!effectiveScenarioId || !file) return;
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("scenarioId", effectiveScenarioId);
      formData.append("file", file);
      const batch = await apiClient.postForm<ImportBatch>("/imports", formData);
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
      const updated = await apiClient.patch<ImportBatch>(
        `/imports/${wizard.batch.id}`,
        {
          mapping: mappingDraft,
        },
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
        batch: ImportBatch;
        committedLines: BudgetLine[];
      }>(`/imports/${wizard.batch.id}/commit`, {});
      setCommittedCount(result.committedLines.length);
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
  const validRowCount =
    wizard.step === "review"
      ? wizard.batch.rows.filter(
          (r) => r.categoryId && r.month !== null && r.amount !== null,
        ).length
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">İçe Aktarma</h1>
        <p className="mt-1 text-sm text-muted">
          Mizan veya Muavin defterinizi (CSV/Excel) yükleyin, dosyadaki kolonları{" "}
          <span className="font-medium text-ink">Kategori / Ay / Tutar</span> ile
          eşleştirin, önizleyin ve onaylayın. Onaylanan satırlar aynı kategori+ay için
          toplanarak bütçe hücrelerine yazılır — bu işlem de manuel giriş gibi kilit
          kontrolünden ve denetim kaydından (bkz. Denetim Kaydı) geçer.
        </p>
      </div>

      {wizard.step === "upload" ? (
        <Card title="1. Dosya Yükle">
          <div className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium text-ink"
                htmlFor="import-scenario"
              >
                Hedef Senaryo
              </label>
              <select
                id="import-scenario"
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
                htmlFor="import-file"
              >
                Mizan / Muavin Dosyası (.csv, .xlsx, .xls)
              </label>
              <input
                id="import-file"
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
                              targetField: e.target.value as ImportTargetField,
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
            hint={`${wizard.batch.rows.length} satır · ${validRowCount} geçerli · ${wizard.batch.issues.length} sorun`}
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
                      <th className="pb-2 font-medium">Kategori</th>
                      <th className="pb-2 font-medium">Ay</th>
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
                          {row.categoryName ?? (
                            <span className="text-brick">eşleşmedi</span>
                          )}
                        </td>
                        <td className="tabular py-2">
                          {row.month ?? <span className="text-brick">-</span>}
                        </td>
                        <td className="tabular py-2 text-right">
                          {row.amount !== null ? (
                            formatAmount(row.amount)
                          ) : (
                            <span className="text-brick">-</span>
                          )}
                        </td>
                        <td className="py-2">
                          {issuesByRow.has(row.rowNumber) ? (
                            <Badge tone="brick">
                              {issuesByRow.get(row.rowNumber)!.join(" · ")}
                            </Badge>
                          ) : (
                            <Badge tone="ledger">Geçerli</Badge>
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
                <span className="font-medium text-ink">{validRowCount}</span> geçerli
                satır{" "}
                <span className="font-medium text-ink">{wizard.batch.scenarioId}</span>{" "}
                senaryosuna yazılacak. Aynı kategori + ay için birden fazla satır varsa
                (Mizan&apos;da alt hesap kırılımı gibi) toplanır.
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
                <span className="font-medium">{wizard.batch.fileName}</span> içindeki{" "}
                {committedCount} hücre bütçeye yazıldı.
              </span>
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/butce-girisi" className={SECONDARY_BUTTON}>
                Bütçe Girişi&apos;nde Gör
              </Link>
              <Link href="/denetim-kaydi" className={SECONDARY_BUTTON}>
                Denetim Kaydında Gör
              </Link>
              <button onClick={handleReset} className={PRIMARY_BUTTON}>
                Yeni İçe Aktarma
              </button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
