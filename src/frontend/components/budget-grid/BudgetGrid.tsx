"use client";

import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import type {
  CellFocusedEvent,
  CellValueChangedEvent,
  ColDef,
  ValueFormatterParams,
  ValueParserParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { parseAmount, parseClipboardGrid } from "@/frontend/lib/clipboard";
import { formatAmount } from "@/frontend/lib/format";
import { MONTH_FIELDS, MONTHS, type MonthField } from "@/shared/constants/months";
import type { BudgetCategory, BudgetLine, BudgetLineInput } from "@/shared/types";

import { budgetGridTheme } from "./budget-grid.theme";
import {
  type GridRow,
  pivotToRows,
  redistributeTotal,
  round2,
  toLineInputs,
} from "./budget-grid.utils";

// AG Grid v33+ tree-shaking gereği: kullanılacak modüller elle kaydedilir.
// Bu dosya sadece client'ta yüklendiği için (bkz. BudgetEntryScreen'deki
// dynamic(..., { ssr: false })) SSR'da hiç import edilmez.
ModuleRegistry.registerModules([AllCommunityModule]);

interface BudgetGridProps {
  categories: BudgetCategory[];
  lines: BudgetLine[];
  /** Senaryo kilitliyse false: tüm hücreler salt okunur. */
  editable: boolean;
  /** Bir veya birden çok hücre değiştiğinde (tek düzenleme ya da yapıştırma) çağrılır. */
  onCellsChanged: (changed: BudgetLineInput[]) => void;
}

interface ActiveCell {
  rowIndex: number;
  field: string;
}

/**
 * Excel benzeri bütçe giriş tablosu (AG Grid Community).
 *
 * - Aşağıdan yukarıya giriş: ay hücrelerini tek tek doldurursunuz, satırın
 *   "Yıllık Toplam"ı ve alttaki sütun toplamları otomatik güncellenir.
 * - Yukarıdan aşağıya giriş: bir satırın "Yıllık Toplam" hücresine yıllık
 *   rakamı yazarsınız, 12 aya (mevcut dağılımı koruyarak, satır boşsa eşit)
 *   otomatik dağıtılır — bkz. redistributeTotal.
 * - Kopyala/yapıştır: AG Grid Community'de native çoklu-hücre clipboard yok
 *   (Enterprise özelliği). Burada kendi yazdığımız basit sürüm var: Excel'den
 *   kopyalanan bir blok, odaklanılan hücreden başlayarak satır/sütunlara
 *   yapıştırılır; tek hücre kopyalama (Ctrl+C) native çalışır.
 */
export function BudgetGrid({
  categories,
  lines,
  editable,
  onCellsChanged,
}: BudgetGridProps) {
  const [rows, setRows] = useState<GridRow[]>(() => pivotToRows(categories, lines));

  // Native `copy`/`paste` event handler'ları component mount'ta bir kez
  // bağlanır (bkz. alttaki effect); güncel veriye ref üzerinden erişirler.
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const editableRef = useRef(editable);
  useEffect(() => {
    editableRef.current = editable;
  }, [editable]);

  const onCellsChangedRef = useRef(onCellsChanged);
  useEffect(() => {
    onCellsChangedRef.current = onCellsChanged;
  }, [onCellsChanged]);

  const activeCellRef = useRef<ActiveCell | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleCellFocused = useCallback((event: CellFocusedEvent) => {
    if (event.rowIndex == null || !event.column || event.rowPinned) {
      activeCellRef.current = null;
      return;
    }
    const field =
      typeof event.column === "string" ? event.column : event.column.getColId();
    activeCellRef.current = { rowIndex: event.rowIndex, field };
  }, []);

  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent<GridRow>) => {
      const field = event.colDef.field;
      const data = event.data;
      if (!field || !data) return;

      const current = rowsRef.current;
      const idx = current.findIndex((r) => r.categoryId === data.categoryId);
      if (idx === -1) return;

      const row = { ...current[idx] };

      if (field === "total") {
        const distributed = redistributeTotal(row, parseAmount(String(event.newValue)));
        MONTH_FIELDS.forEach((f, i) => (row[f] = distributed[i]));
        row.total = round2(distributed.reduce((sum, v) => sum + v, 0));
      } else if ((MONTH_FIELDS as readonly string[]).includes(field)) {
        row[field as MonthField] = parseAmount(String(event.newValue));
        row.total = round2(MONTH_FIELDS.reduce((sum, f) => sum + row[f], 0));
      } else {
        return;
      }

      const next = [...current];
      next[idx] = row;
      setRows(next);
      onCellsChangedRef.current(toLineInputs(row));
    },
    [],
  );

  const handlePaste = useCallback((event: ClipboardEvent) => {
    if (!editableRef.current) return;
    const active = activeCellRef.current;
    if (!active) return;

    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (!text.trim()) return;
    event.preventDefault();

    const grid = parseClipboardGrid(text);
    const current = rowsRef.current;
    const next = [...current];
    const changed: BudgetLineInput[] = [];

    grid.forEach((gridRow, r) => {
      const targetIdx = active.rowIndex + r;
      if (targetIdx >= next.length) return;
      const row = { ...next[targetIdx] };

      if (active.field === "total") {
        // Toplam sütununa yapıştırma: her satır kendi yıllık toplamını alır.
        const distributed = redistributeTotal(row, gridRow[0] ?? 0);
        MONTH_FIELDS.forEach((f, i) => (row[f] = distributed[i]));
        row.total = round2(distributed.reduce((sum, v) => sum + v, 0));
      } else {
        const startCol = (MONTH_FIELDS as readonly string[]).includes(active.field)
          ? MONTH_FIELDS.indexOf(active.field as MonthField)
          : 0;
        gridRow.forEach((value, c) => {
          const colIdx = startCol + c;
          if (colIdx >= MONTH_FIELDS.length) return; // Aralık'tan taşan hücreler atlanır.
          row[MONTH_FIELDS[colIdx]] = value;
        });
        row.total = round2(MONTH_FIELDS.reduce((sum, f) => sum + row[f], 0));
      }

      next[targetIdx] = row;
      changed.push(...toLineInputs(row));
    });

    if (changed.length === 0) return;
    setRows(next);
    onCellsChangedRef.current(changed);
  }, []);

  const handleCopy = useCallback((event: ClipboardEvent) => {
    const active = activeCellRef.current;
    if (!active) return;
    const row = rowsRef.current[active.rowIndex];
    if (!row) return;
    if (
      active.field !== "total" &&
      !(MONTH_FIELDS as readonly string[]).includes(active.field)
    ) {
      return;
    }

    const value = row[active.field as MonthField | "total"];
    event.clipboardData?.setData("text/plain", String(value ?? 0));
    event.preventDefault();
  }, []);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    el.addEventListener("paste", handlePaste);
    el.addEventListener("copy", handleCopy);
    return () => {
      el.removeEventListener("paste", handlePaste);
      el.removeEventListener("copy", handleCopy);
    };
  }, [handlePaste, handleCopy]);

  const columnDefs = useMemo<ColDef<GridRow>[]>(() => {
    const monthCols: ColDef<GridRow>[] = MONTHS.map((m) => ({
      field: m.field,
      headerName: m.label,
      editable,
      type: "numericColumn",
      minWidth: 104,
      cellClass: "tabular",
      valueParser: (p: ValueParserParams<GridRow>) => parseAmount(String(p.newValue)),
      valueFormatter: (p: ValueFormatterParams<GridRow>) =>
        formatAmount(Number(p.value) || 0),
    }));

    return [
      {
        field: "categoryName",
        headerName: "Kategori",
        pinned: "left",
        editable: false,
        minWidth: 180,
        cellClass: "font-medium",
      },
      ...monthCols,
      {
        field: "total",
        headerName: "Yıllık Toplam",
        pinned: "right",
        editable,
        type: "numericColumn",
        minWidth: 150,
        cellClass: "tabular font-semibold",
        valueParser: (p: ValueParserParams<GridRow>) => parseAmount(String(p.newValue)),
        valueFormatter: (p: ValueFormatterParams<GridRow>) =>
          formatAmount(Number(p.value) || 0),
      },
    ];
  }, [editable]);

  const defaultColDef = useMemo<ColDef<GridRow>>(
    () => ({ resizable: true, sortable: false, filter: false, suppressMovable: true }),
    [],
  );

  const pinnedBottomRowData = useMemo<GridRow[]>(() => {
    const totals = {
      categoryId: "__total__",
      categoryName: "TOPLAM",
      total: 0,
    } as GridRow;
    for (const field of MONTH_FIELDS) {
      totals[field] = round2(rows.reduce((sum, row) => sum + row[field], 0));
    }
    totals.total = round2(MONTH_FIELDS.reduce((sum, field) => sum + totals[field], 0));
    return [totals];
  }, [rows]);

  const getRowId = useCallback(
    (params: { data: GridRow }) => params.data.categoryId,
    [],
  );

  return (
    <div
      ref={wrapperRef}
      className="h-[calc(100vh-24rem)] max-h-[820px] min-h-[360px] w-full"
    >
      <AgGridReact<GridRow>
        theme={budgetGridTheme}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        pinnedBottomRowData={pinnedBottomRowData}
        getRowId={getRowId}
        singleClickEdit
        stopEditingWhenCellsLoseFocus
        enableCellTextSelection
        ensureDomOrder
        onCellValueChanged={handleCellValueChanged}
        onCellFocused={handleCellFocused}
      />
    </div>
  );
}
