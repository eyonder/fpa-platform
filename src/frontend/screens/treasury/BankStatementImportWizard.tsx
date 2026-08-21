"use client";

import { useCallback, useRef, useState } from "react";

import { Badge } from "@/frontend/components/ui/Badge";
import { Card } from "@/frontend/components/ui/Card";
import { bankAccountLabel } from "@/frontend/hooks/useBankAccounts";
import { apiClient, ApiError } from "@/frontend/lib/api-client";
import { formatAmount } from "@/frontend/lib/format";
import type {
  BankAccount,
  BankColumnMapping,
  BankImportBatch,
  BankTargetField,
} from "@/shared/types";

type WizardState =
  | { step: "upload" }
  | { step: "review"; batch: BankImportBatch }
  | { step: "done"; batch: BankImportBatch };

const TARGET_FIELD_LABEL: Record<BankTargetField, string> = {
  valueDate: "Valör / Tarih",
  description: "Açıklama",
  counterparty: "Karşı Taraf",
  amount: "Tutar (işaretli)",
  debit: "Borç (çıkış)",
  credit: "Alacak (giriş)",
  externalRef: "Referans No",
  skip: "(Yoksay)",
};

const TARGET_FIELDS: BankTargetField[] = [
  "valueDate",
  "description",
  "counterparty",
  "amount",
  "debit",
  "credit",
  "externalRef",
  "skip",
];

const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const SECONDARY_BUTTON =
  "rounded-md border border-rule px-4 py-2 text-sm transition-colors hover:bg-paper focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";
const SELECT_CLASS =
  "w-full rounded-md border border-rule bg-surface px-2 py-1 text-xs focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";

const MAX_PREVIEW_ROWS = 25;

/**
 * `ThpImportWizard.tsx` ile AYNI 3 adımlı iskelet (Yükle -> Eşleştir ->
 * Onayla), banka ekstresi sütunlarına uyarlanmış. Önizleme HER remap'te
 * SUNUCUDA yeniden hesaplanır (bkz. bank-import.service.ts) — burada hiçbir
 * şey lokalde türetilmez.
 *
 * THP sihirbazından tek görünür fark: mükerrer referanslı satırlar HATA
 * değil, "Mükerrer" rozetiyle işaretlenir ve onayda sessizce atlanır.
 */
export function BankStatementImportWizard({
  scenarioId,
  accounts,
  onCommitted,
}: {
  scenarioId: string;
  accounts: BankAccount[];
  onCommitted: () => void;
}) {
  // Bir ekstre TEK bir hesaba aittir ve tutarları o hesabın para birimindedir —
  // hesabı seçtirmeden yazmak USD bir ekstreyi TL hesaba dökmek olurdu.
  const [bankAccountId, setBankAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [wizard, setWizard] = useState<WizardState>({ step: "upload" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [mappingDraft, setMappingDraft] = useState<BankColumnMapping[]>([]);
  const [remapping, setRemapping] = useState(false);
  const [remapError, setRemapError] = useState<string | null>(null);

  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);

  const reset = useCallback(() => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setWizard({ step: "upload" });
    setMappingDraft([]);
    setUploadError(null);
    setRemapError(null);
    setCommitError(null);
    setCreatedCount(0);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!scenarioId || !file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("scenarioId", scenarioId);
      formData.append("file", file);
      const batch = await apiClient.postForm<BankImportBatch>(
        "/treasury/bank-transactions/import",
        formData,
      );
      setMappingDraft(batch.appliedMapping);
      setWizard({ step: "review", batch });
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Dosya yüklenemedi.");
    } finally {
      setUploading(false);
    }
  }, [scenarioId, file]);

  const handleRemap = useCallback(async () => {
    if (wizard.step !== "review") return;
    setRemapping(true);
    setRemapError(null);
    try {
      const batch = await apiClient.patch<BankImportBatch>(
        `/treasury/bank-transactions/import/${wizard.batch.id}`,
        { mapping: mappingDraft },
      );
      setWizard({ step: "review", batch });
    } catch (err) {
      setRemapError(
        err instanceof ApiError ? err.message : "Eşleştirme güncellenemedi.",
      );
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
        batch: BankImportBatch;
        createdCount: number;
      }>(`/treasury/bank-transactions/import/${wizard.batch.id}/commit`, {
        bankAccountId: bankAccountId || accounts[0]?.id,
      });
      setCreatedCount(result.createdCount);
      setWizard({ step: "done", batch: result.batch });
      onCommitted();
    } catch (err) {
      setCommitError(
        err instanceof ApiError ? err.message : "İçe aktarım onaylanamadı.",
      );
    } finally {
      setCommitting(false);
    }
  }, [wizard, onCommitted, bankAccountId, accounts]);

  return (
    <Card
      title="Banka Ekstresi İçe Aktar"
      hint={wizard.step === "review" ? wizard.batch.fileName : ".xlsx / .xls / .csv"}
    >
      {wizard.step === "upload" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Ekstre dosyanızı yükleyin. Sütunlar otomatik tahmin edilir, bir sonraki
            adımda düzeltebilirsiniz. Referans numarası eşleşen satırlar mükerrer
            sayılıp atlanır.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border file:border-rule file:bg-paper file:px-3 file:py-1.5 file:text-sm file:text-ink"
          />
          {uploadError ? <p className="text-sm text-brick">{uploadError}</p> : null}
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={!file || !scenarioId || uploading}
            onClick={handleUpload}
          >
            {uploading ? "Yükleniyor…" : "Yükle ve Önizle"}
          </button>
        </div>
      ) : null}

      {wizard.step === "review" ? (
        <div className="space-y-4">
          <label className="block max-w-xs">
            <span className="text-xs text-muted">Hangi banka hesabına?</span>
            <select
              className={SELECT_CLASS}
              value={bankAccountId || (accounts[0]?.id ?? "")}
              onChange={(e) => setBankAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {bankAccountLabel(a)}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone="ledger">{wizard.batch.mappedCount} aktarılacak</Badge>
            <Badge tone="neutral">{wizard.batch.skippedCount} atlanacak</Badge>
            <Badge tone="neutral">{wizard.batch.rowCount} satır</Badge>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
              Sütun Eşleştirme
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {mappingDraft.map((column, index) => (
                <label key={column.sourceColumn} className="block">
                  <span className="block truncate text-xs text-muted">
                    {column.sourceColumn || "(başlıksız)"}
                  </span>
                  <select
                    className={SELECT_CLASS}
                    value={column.targetField}
                    onChange={(e) =>
                      setMappingDraft((draft) =>
                        draft.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                targetField: e.target.value as BankTargetField,
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    {TARGET_FIELDS.map((field) => (
                      <option key={field} value={field}>
                        {TARGET_FIELD_LABEL[field]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {remapError ? (
              <p className="mt-2 text-sm text-brick">{remapError}</p>
            ) : null}
            <button
              type="button"
              className={`${SECONDARY_BUTTON} mt-3`}
              disabled={remapping}
              onClick={handleRemap}
            >
              {remapping ? "Yeniden hesaplanıyor…" : "Eşleştirmeyi Uygula"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-rule text-left text-muted">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Valör</th>
                  <th className="py-2 pr-3">Açıklama</th>
                  <th className="py-2 pr-3">Karşı Taraf</th>
                  <th className="py-2 pr-3 text-right">Tutar</th>
                  <th className="py-2 pr-3">Yön</th>
                  <th className="py-2 pr-3">Durum</th>
                </tr>
              </thead>
              <tbody>
                {wizard.batch.rows.slice(0, MAX_PREVIEW_ROWS).map((row) => {
                  const usable =
                    !row.isDuplicate && row.valueDate !== null && row.amount !== null;
                  return (
                    <tr key={row.rowNumber} className="border-b border-rule/60">
                      <td className="py-1.5 pr-3 text-muted">{row.rowNumber}</td>
                      <td className="tabular py-1.5 pr-3">{row.valueDate ?? "—"}</td>
                      <td className="max-w-[18rem] truncate py-1.5 pr-3">
                        {row.description ?? "—"}
                      </td>
                      <td className="max-w-[10rem] truncate py-1.5 pr-3 text-muted">
                        {row.counterparty ?? "—"}
                      </td>
                      <td className="tabular py-1.5 pr-3 text-right">
                        {row.amount === null ? "—" : formatAmount(row.amount)}
                      </td>
                      <td className="py-1.5 pr-3">
                        {row.direction === "INFLOW"
                          ? "Giriş"
                          : row.direction === "OUTFLOW"
                            ? "Çıkış"
                            : "—"}
                      </td>
                      <td className="py-1.5 pr-3">
                        {row.isDuplicate ? (
                          <Badge tone="brick">Mükerrer</Badge>
                        ) : usable ? (
                          <Badge tone="ledger">Aktarılacak</Badge>
                        ) : (
                          <Badge tone="neutral">Atlanacak</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {wizard.batch.rows.length > MAX_PREVIEW_ROWS ? (
              <p className="mt-2 text-xs text-muted">
                İlk {MAX_PREVIEW_ROWS} satır gösteriliyor ({wizard.batch.rows.length}{" "}
                satırdan).
              </p>
            ) : null}
          </div>

          {wizard.batch.issues.length > 0 ? (
            <details className="rounded-md border border-rule bg-paper px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium">
                {wizard.batch.issues.length} uyarı
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {wizard.batch.issues.slice(0, 50).map((issue, i) => (
                  <li key={`${issue.rowNumber}-${issue.code}-${i}`}>
                    Satır {issue.rowNumber}: {issue.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {commitError ? <p className="text-sm text-brick">{commitError}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={
                committing || wizard.batch.mappedCount === 0 || accounts.length === 0
              }
              onClick={handleCommit}
            >
              {committing ? "Aktarılıyor…" : "Onayla ve Aktar"}
            </button>
            <button type="button" className={SECONDARY_BUTTON} onClick={reset}>
              Vazgeç
            </button>
          </div>
        </div>
      ) : null}

      {wizard.step === "done" ? (
        <div className="space-y-3">
          <p className="text-sm">
            <span className="font-medium">{createdCount}</span> banka hareketi
            aktarıldı.
          </p>
          <button type="button" className={SECONDARY_BUTTON} onClick={reset}>
            Yeni Ekstre Yükle
          </button>
        </div>
      ) : null}
    </Card>
  );
}
