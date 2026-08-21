"use client";

import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import type {
  CellClassParams,
  CellValueChangedEvent,
  ColDef,
  EditableCallbackParams,
  ValueFormatterParams,
  ValueParserParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useMemo } from "react";

import { parseAmount } from "@/frontend/lib/clipboard";
import { formatAmount } from "@/frontend/lib/format";
import type {
  BudgetCategory,
  ProjectionRow,
  UpdateCashFlowEventInput,
} from "@/shared/types";

import { treasuryGridTheme } from "./treasury-grid.theme";
import {
  formatDateTr,
  parseDateTr,
  SOURCE_LABEL,
  SOURCE_OWNER_HINT,
  STATUS_LABEL,
} from "./treasury-grid.utils";

// AG Grid v33+ tree-shaking gereği: modüller elle kaydedilir. Bu dosya sadece
// client'ta yüklenir (bkz. TreasuryScreen'deki dynamic(..., { ssr: false })).
ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * Düzenlenebilir alanlar, `UpdateCashFlowEventInput`tan TÜRETİLİR — böylece
 * API sözleşmesiyle uyuşmazlık DERLEME HATASI olur.
 *
 * Bu tip bilerek `keyof` üzerinden kuruldu: grid'in satır alanı `date`,
 * API'nin alanı ise `dueDate`. Grid alan adını doğrudan gövdeye koyduğumuz
 * ilk sürümde PATCH `{ date: ... }` gönderiyordu; Zod bilinmeyen anahtarları
 * SESSİZCE atar, uç 200 dönüyor ama HİÇBİR ŞEY değişmiyordu — bir nakit
 * defterinde en kötü hata türü (canlı doğrulamada yakalandı).
 */
type EditableField = Extract<
  keyof UpdateCashFlowEventInput,
  "dueDate" | "direction" | "categoryId" | "counterparty" | "description" | "amount"
>;

export interface LedgerEdit {
  eventId: string;
  /** API alan adı — grid sütun adı DEĞİL (bkz. yukarıdaki not). */
  field: EditableField;
  value: string | number;
}

interface TreasuryLedgerGridProps {
  rows: ProjectionRow[];
  categories: BudgetCategory[];
  currency: string;
  /** Senaryo kilitli, izin yok ya da simülasyon aktifse false. */
  editable: boolean;
  onEdit: (edit: LedgerEdit) => void;
  /** Kalıcı bir satırı siler (yalnızca düzenlenebilir satırlarda gösterilir). */
  onDelete?: (eventId: string) => void;
}

/**
 * NAKİT DEFTERİ (Grid A) — satır başına bir YÜKÜMLÜLÜK, güne göre DEĞİL.
 *
 * Bunun sebebi doğrudan gereksinimden gelir: bir vade tarihini satır içinde
 * düzenleyebilmek için satırın bir gün değil, bir yükümlülük OLMASI gerekir.
 * Günlük toplamlar ayrı ızgaradadır (TreasuryProjectionGrid).
 *
 * Türetilmiş satırlar (Satış/Capex/Bordro) ve simülasyon satırları
 * DÜZENLENEMEZ — sahibi başka bir modüldür; burada değiştirilirse iki modül
 * sessizce ayrışır (bkz. treasury-derivations.ts dosya başı notu).
 *
 * Nötrlenmiş satırlar ÜSTÜ ÇİZİLİ ve soluk gösterilir ama GİZLENMEZ:
 * gizlenselerdi bakiye açıklanamaz hale gelirdi (para nereye gitti?).
 */
export function TreasuryLedgerGrid({
  rows,
  categories,
  currency,
  editable,
  onEdit,
  onDelete,
}: TreasuryLedgerGridProps) {
  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories]);
  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const isEditable = useCallback(
    (params: EditableCallbackParams<ProjectionRow>) =>
      editable && Boolean(params.data?.editable),
    [editable],
  );

  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<ProjectionRow>) => {
      const row = event.data;
      const field = event.colDef.field;
      if (!row?.eventId || !field || event.newValue === event.oldValue) return;

      if (field === "date") {
        const parsed = parseDateTr(String(event.newValue));
        // Çözülemeyen tarih SESSİZCE bugüne düşmez — düzenleme yok sayılır
        // ve ızgara eski değere döner (bkz. treasury.dates.ts'teki aynı kural).
        if (!parsed) {
          event.node.setDataValue("date", event.oldValue);
          return;
        }
        onEdit({ eventId: row.eventId, field: "dueDate", value: parsed });
        return;
      }

      if (field === "amount") {
        const amount = parseAmount(String(event.newValue));
        if (!(amount > 0)) {
          event.node.setDataValue("amount", event.oldValue);
          return;
        }
        onEdit({ eventId: row.eventId, field: "amount", value: amount });
        return;
      }

      if (field === "direction") {
        onEdit({
          eventId: row.eventId,
          field: "direction",
          value: String(event.newValue),
        });
        return;
      }

      if (field === "categoryId") {
        onEdit({
          eventId: row.eventId,
          field: "categoryId",
          value: String(event.newValue),
        });
        return;
      }

      if (field === "counterparty" || field === "description") {
        onEdit({ eventId: row.eventId, field, value: String(event.newValue ?? "") });
      }
    },
    [onEdit],
  );

  const columnDefs = useMemo<ColDef<ProjectionRow>[]>(
    () => [
      {
        field: "date",
        headerName: "Vade",
        pinned: "left",
        minWidth: 116,
        editable: isEditable,
        cellClass: "tabular",
        valueFormatter: (p: ValueFormatterParams<ProjectionRow>) =>
          p.value ? formatDateTr(String(p.value)) : "",
      },
      {
        field: "direction",
        headerName: "Yön",
        minWidth: 108,
        editable: isEditable,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: ["INFLOW", "OUTFLOW"] },
        valueFormatter: (p: ValueFormatterParams<ProjectionRow>) =>
          p.value === "INFLOW" ? "Tahsilat" : "Ödeme",
      },
      {
        field: "categoryId",
        headerName: "Kategori",
        minWidth: 168,
        editable: isEditable,
        cellEditor: "agSelectCellEditor",
        cellEditorParams: { values: categoryIds },
        valueFormatter: (p: ValueFormatterParams<ProjectionRow>) =>
          categoryNameById.get(String(p.value)) ?? String(p.value ?? ""),
      },
      {
        field: "counterparty",
        headerName: "Karşı Taraf",
        minWidth: 168,
        editable: isEditable,
      },
      {
        field: "description",
        headerName: "Açıklama",
        minWidth: 220,
        editable: isEditable,
      },
      {
        field: "amount",
        headerName: "Tutar",
        minWidth: 140,
        type: "numericColumn",
        editable: isEditable,
        cellClass: "tabular",
        valueParser: (p: ValueParserParams<ProjectionRow>) =>
          parseAmount(String(p.newValue)),
        valueFormatter: (p: ValueFormatterParams<ProjectionRow>) =>
          formatAmount(Number(p.value) || 0, currency),
      },
      {
        field: "source",
        headerName: "Kaynak",
        minWidth: 116,
        editable: false,
        valueFormatter: (p: ValueFormatterParams<ProjectionRow>) =>
          SOURCE_LABEL[p.value as keyof typeof SOURCE_LABEL] ?? String(p.value ?? ""),
        tooltipValueGetter: (p) =>
          p.data ? (SOURCE_OWNER_HINT[p.data.source] ?? "") : "",
      },
      {
        field: "status",
        headerName: "Durum",
        minWidth: 116,
        editable: false,
        valueFormatter: (p: ValueFormatterParams<ProjectionRow>) =>
          p.value ? (STATUS_LABEL[p.value as keyof typeof STATUS_LABEL] ?? "") : "—",
      },
      {
        field: "accrualStartMonth",
        headerName: "Muh. Ayı",
        minWidth: 104,
        editable: false,
        cellClass: "tabular",
        valueFormatter: (p: ValueFormatterParams<ProjectionRow>) =>
          p.value ? String(p.value) : "—",
      },
      {
        colId: "actions",
        headerName: "",
        minWidth: 72,
        maxWidth: 72,
        editable: false,
        sortable: false,
        // Sadece KALICI ve düzenlenebilir satırlar silinebilir — türetilmiş
        // satırın sahibi başka bir modüldür, buradan silmek anlamsızdır.
        cellRenderer: (p: { data?: ProjectionRow }) =>
          editable && p.data?.editable && p.data.eventId ? (
            <button
              type="button"
              className="text-xs text-brick underline underline-offset-2"
              onClick={() => onDelete?.(p.data!.eventId!)}
            >
              Sil
            </button>
          ) : null,
      },
    ],
    [isEditable, categoryIds, categoryNameById, currency, editable, onDelete],
  );

  const defaultColDef = useMemo<ColDef<ProjectionRow>>(
    () => ({
      resizable: true,
      sortable: true,
      filter: false,
      suppressMovable: true,
      cellClassRules: {
        // Nötrlenmiş: görünür ama görsel olarak "düşülmüş".
        "line-through opacity-50": (p: CellClassParams<ProjectionRow>) =>
          p.data?.status === "NEUTRALIZED",
        "opacity-70": (p: CellClassParams<ProjectionRow>) =>
          p.data?.source === "SIMULATION",
      },
    }),
    [],
  );

  const getRowId = useCallback(
    (params: { data: ProjectionRow }) => params.data.rowId,
    [],
  );

  return (
    <div className="h-[calc(100vh-24rem)] max-h-[820px] min-h-[360px] w-full">
      <AgGridReact<ProjectionRow>
        theme={treasuryGridTheme}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={getRowId}
        singleClickEdit
        stopEditingWhenCellsLoseFocus
        enableCellTextSelection
        ensureDomOrder
        tooltipShowDelay={300}
        onCellValueChanged={handleCellValueChanged}
      />
    </div>
  );
}
