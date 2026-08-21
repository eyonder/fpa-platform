"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/frontend/components/ui/Badge";
import { parseDateTr } from "@/frontend/components/treasury-grid/treasury-grid.utils";
import { parseAmount, parseClipboardTable } from "@/frontend/lib/clipboard";
import { formatAmount } from "@/frontend/lib/format";
import type { BudgetCategory, CashFlowDirection } from "@/shared/types";

const PRIMARY_BUTTON =
  "rounded-md bg-ledger px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ledger focus-visible:ring-offset-2 focus-visible:outline-none";
const SECONDARY_BUTTON =
  "rounded-md border border-rule px-4 py-2 text-sm transition-colors hover:bg-paper focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none";

export interface PastedRow {
  rowNumber: number;
  date: string | null;
  direction: CashFlowDirection | null;
  categoryId: string | null;
  counterparty: string | null;
  amount: number | null;
  issues: string[];
}

const INFLOW_WORDS = ["tahsilat", "giris", "giriş", "gelir", "inflow", "alacak"];

function resolveDirection(raw: string): CashFlowDirection | null {
  const value = raw.trim().toLocaleLowerCase("tr-TR");
  if (!value) return null;
  if (value === "inflow" || INFLOW_WORDS.some((w) => value.includes(w)))
    return "INFLOW";
  return "OUTFLOW";
}

function resolveCategory(raw: string, categories: BudgetCategory[]): string | null {
  const value = raw.trim().toLocaleLowerCase("tr-TR");
  if (!value) return null;
  const match = categories.find(
    (c) =>
      c.id.toLocaleLowerCase("tr-TR") === value ||
      c.name.toLocaleLowerCase("tr-TR") === value,
  );
  return match?.id ?? null;
}

/** Sabit sütun sırası — serbest eşleştirme sihirbazı DOSYA yüklemesi içindir
 * (Faz 4.2), pano yapıştırması için fazla ağırdır. */
export const PASTE_COLUMNS = "Vade | Yön | Kategori | Karşı Taraf | Tutar";

export function parsePastedLedger(
  text: string,
  categories: BudgetCategory[],
): PastedRow[] {
  return parseClipboardTable(text)
    .filter((cells) => cells.some((cell) => cell !== ""))
    .map((cells, index) => {
      const issues: string[] = [];

      const date = parseDateTr(cells[0] ?? "");
      if (!date) issues.push("Vade tarihi okunamadı");

      const direction = resolveDirection(cells[1] ?? "");
      if (!direction) issues.push("Yön boş");

      const categoryId = resolveCategory(cells[2] ?? "", categories);
      if (!categoryId) issues.push("Kategori eşleşmedi");

      const rawAmount = (cells[4] ?? "").trim();
      const amount = rawAmount ? Math.abs(parseAmount(rawAmount)) : null;
      if (amount === null || amount === 0) issues.push("Tutar okunamadı");

      return {
        rowNumber: index + 1,
        date,
        direction,
        categoryId,
        counterparty: (cells[3] ?? "").trim() || null,
        amount,
        issues,
      };
    });
}

/**
 * EXCEL'DEN YAPIŞTIR — ÖNİZLEMELİ.
 *
 * Panodan gelen blok defterin İÇİNE SESSİZCE yazılmaz; önce bu diyalogda
 * ayrıştırılmış hali ve satır bazlı sorunlar gösterilir, kullanıcı Onayla'ya
 * basar. Bir nakit defterinde sessiz yapıştırma, yanlış sütundan gelen bir
 * telefon numarasının tutar alanına düşmesinin en kolay yoludur — tek bir
 * modal bütün bu hata sınıfını ortadan kaldırır.
 */
export function PasteDialog({
  categories,
  onCancel,
  onConfirm,
}: {
  categories: BudgetCategory[];
  onCancel: () => void;
  onConfirm: (rows: PastedRow[]) => void;
}) {
  const [text, setText] = useState("");
  const rows = useMemo(() => parsePastedLedger(text, categories), [text, categories]);
  const valid = rows.filter((r) => r.issues.length === 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-lg border border-rule bg-surface shadow-lg">
        <header className="flex items-baseline justify-between gap-4 border-b border-rule px-5 py-3">
          <h2 className="text-sm font-semibold tracking-tight">
            Excel&apos;den Yapıştır
          </h2>
          <p className="text-xs text-muted">Sütun sırası: {PASTE_COLUMNS}</p>
        </header>

        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-muted">
            Excel&apos;den kopyaladığınız hücreleri aşağıya yapıştırın. Aşağıdaki
            önizlemede sorunsuz görünen satırlar deftere eklenir; sorunlu satırlar
            atlanır.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={"15.09.2026\tÖdeme\tKira & Ofis\tLambda GYO\t30.000,00"}
            className="w-full rounded-md border border-rule bg-paper px-3 py-2 font-mono text-xs focus-visible:ring-2 focus-visible:ring-ledger focus-visible:outline-none"
          />

          {rows.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone="ledger">{valid.length} eklenecek</Badge>
                <Badge tone={rows.length - valid.length > 0 ? "brick" : "neutral"}>
                  {rows.length - valid.length} atlanacak
                </Badge>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-rule text-left text-muted">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Vade</th>
                      <th className="py-2 pr-3">Yön</th>
                      <th className="py-2 pr-3">Kategori</th>
                      <th className="py-2 pr-3">Karşı Taraf</th>
                      <th className="py-2 pr-3 text-right">Tutar</th>
                      <th className="py-2 pr-3">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.rowNumber} className="border-b border-rule/60">
                        <td className="py-1.5 pr-3 text-muted">{row.rowNumber}</td>
                        <td className="tabular py-1.5 pr-3">{row.date ?? "—"}</td>
                        <td className="py-1.5 pr-3">
                          {row.direction === "INFLOW"
                            ? "Tahsilat"
                            : row.direction === "OUTFLOW"
                              ? "Ödeme"
                              : "—"}
                        </td>
                        <td className="py-1.5 pr-3">
                          {categories.find((c) => c.id === row.categoryId)?.name ?? "—"}
                        </td>
                        <td className="max-w-[12rem] truncate py-1.5 pr-3 text-muted">
                          {row.counterparty ?? "—"}
                        </td>
                        <td className="tabular py-1.5 pr-3 text-right">
                          {row.amount === null ? "—" : formatAmount(row.amount)}
                        </td>
                        <td className="py-1.5 pr-3">
                          {row.issues.length === 0 ? (
                            <Badge tone="ledger">Hazır</Badge>
                          ) : (
                            <span className="text-brick">{row.issues.join(", ")}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-rule px-5 py-3">
          <button type="button" className={SECONDARY_BUTTON} onClick={onCancel}>
            Vazgeç
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={valid.length === 0}
            onClick={() => onConfirm(valid)}
          >
            Onayla ({valid.length} satır)
          </button>
        </footer>
      </div>
    </div>
  );
}
