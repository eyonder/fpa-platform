"use client";

import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import type { CellClassParams, ColDef, ValueFormatterParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useMemo } from "react";

import { formatAmount } from "@/frontend/lib/format";
import type { ProjectionBucket, ProjectionGranularity } from "@/shared/types";

import { treasuryGridTheme } from "./treasury-grid.theme";
import { formatDateTr, isWeekend, weekdayLabel } from "./treasury-grid.utils";

ModuleRegistry.registerModules([AllCommunityModule]);

interface ProjectionGridRow {
  date: string;
  weekday: string;
  inflow: number;
  outflow: number;
  net: number;
  closingBalance: number;
  simulatedBalance: number | null;
  delta: number | null;
}

interface TreasuryProjectionGridProps {
  baseline: ProjectionBucket[];
  simulated: ProjectionBucket[] | null;
  granularity: ProjectionGranularity;
  currency: string;
}

/**
 * 90 GÜNLÜK PROJEKSİYON (Grid B) — SALT OKUNUR, gün (ya da ISO hafta) başına
 * bir satır.
 *
 * DAY↔WEEK geçişi AG Grid'in satır gruplamasıyla YAPILMAZ (o Enterprise
 * özelliği) — kovalama SUNUCUDA yapılır ve buraya hazır gelir; toplamların
 * iki yerde hesaplanması sessiz ayrışma riskidir.
 *
 * Kümülatif bakiye manşet rakamdır: negatife düşen günler kırmızı zeminle
 * işaretlenir, çünkü bu tablonun cevapladığı asıl soru "param ne zaman
 * biter?"dir.
 */
export function TreasuryProjectionGrid({
  baseline,
  simulated,
  granularity,
  currency,
}: TreasuryProjectionGridProps) {
  const rows = useMemo<ProjectionGridRow[]>(() => {
    const simulatedByDate = new Map(simulated?.map((b) => [b.date, b]) ?? []);
    return baseline.map((bucket) => {
      const sim = simulatedByDate.get(bucket.date);
      return {
        date: bucket.date,
        weekday: weekdayLabel(bucket.date),
        inflow: bucket.inflow,
        outflow: bucket.outflow,
        net: bucket.net,
        closingBalance: bucket.closingBalance,
        simulatedBalance: sim ? sim.closingBalance : null,
        delta: sim ? round2(sim.closingBalance - bucket.closingBalance) : null,
      };
    });
  }, [baseline, simulated]);

  const money = useCallback(
    (p: ValueFormatterParams<ProjectionGridRow>) =>
      p.value === null || p.value === undefined
        ? "—"
        : formatAmount(Number(p.value), currency),
    [currency],
  );

  const columnDefs = useMemo<ColDef<ProjectionGridRow>[]>(() => {
    const base: ColDef<ProjectionGridRow>[] = [
      {
        field: "date",
        headerName: granularity === "WEEK" ? "Hafta" : "Tarih",
        pinned: "left",
        minWidth: 120,
        cellClass: "tabular",
        valueFormatter: (p) => (p.value ? formatDateTr(String(p.value)) : ""),
      },
      {
        field: "weekday",
        headerName: "Gün",
        minWidth: 76,
        hide: granularity === "WEEK",
        cellClass: (p: CellClassParams<ProjectionGridRow>) =>
          p.data && isWeekend(p.data.date) ? "text-muted opacity-60" : "",
      },
      {
        field: "inflow",
        headerName: "Giriş",
        type: "numericColumn",
        minWidth: 132,
        cellClass: "tabular",
        valueFormatter: money,
      },
      {
        field: "outflow",
        headerName: "Çıkış",
        type: "numericColumn",
        minWidth: 132,
        cellClass: "tabular",
        valueFormatter: money,
      },
      {
        field: "net",
        headerName: "Net",
        type: "numericColumn",
        minWidth: 132,
        cellClass: "tabular",
        valueFormatter: money,
      },
      {
        field: "closingBalance",
        headerName: "Kümülatif Bakiye",
        type: "numericColumn",
        minWidth: 168,
        cellClass: "tabular font-semibold",
        cellClassRules: {
          "bg-brick-soft text-brick": (p: CellClassParams<ProjectionGridRow>) =>
            Number(p.value) < 0,
        },
        valueFormatter: money,
      },
    ];

    if (!simulated) return base;

    return [
      ...base,
      {
        field: "simulatedBalance",
        headerName: "Sim. Bakiye",
        type: "numericColumn",
        minWidth: 168,
        cellClass: "tabular font-semibold",
        cellClassRules: {
          "bg-brick-soft text-brick": (p: CellClassParams<ProjectionGridRow>) =>
            p.value !== null && Number(p.value) < 0,
        },
        valueFormatter: money,
      },
      {
        field: "delta",
        headerName: "Δ",
        type: "numericColumn",
        minWidth: 140,
        cellClass: "tabular",
        valueFormatter: money,
      },
    ];
  }, [granularity, simulated, money]);

  const defaultColDef = useMemo<ColDef<ProjectionGridRow>>(
    () => ({
      resizable: true,
      sortable: false,
      filter: false,
      editable: false,
      suppressMovable: true,
    }),
    [],
  );

  /** Alt sabit satır: pencerenin TOPLAMLARI + son kapanış bakiyesi. */
  const pinnedBottomRowData = useMemo<ProjectionGridRow[]>(() => {
    if (rows.length === 0) return [];
    const last = rows[rows.length - 1];
    return [
      {
        date: last.date,
        weekday: "TOPLAM",
        inflow: round2(rows.reduce((sum, r) => sum + r.inflow, 0)),
        outflow: round2(rows.reduce((sum, r) => sum + r.outflow, 0)),
        net: round2(rows.reduce((sum, r) => sum + r.net, 0)),
        closingBalance: last.closingBalance,
        simulatedBalance: last.simulatedBalance,
        delta: last.delta,
      },
    ];
  }, [rows]);

  const getRowId = useCallback(
    (params: { data: ProjectionGridRow }) => params.data.date,
    [],
  );

  return (
    <div className="h-[calc(100vh-24rem)] max-h-[820px] min-h-[360px] w-full">
      <AgGridReact<ProjectionGridRow>
        theme={treasuryGridTheme}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        pinnedBottomRowData={pinnedBottomRowData}
        getRowId={getRowId}
        enableCellTextSelection
        ensureDomOrder
      />
    </div>
  );
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
