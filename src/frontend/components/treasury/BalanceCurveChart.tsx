"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";

import { formatAmount, formatCompactAmount } from "@/frontend/lib/format";
import { formatDateTr } from "@/frontend/components/treasury-grid/treasury-grid.utils";
import type { ProjectionBucket, ProjectionSummary } from "@/shared/types";

// `BudgetTrendChart` ile AYNI kategorik palet yuvaları — taban çizgi
// "bütçe"nin, simülasyon "gerçekleşen/tahmin"in rengini alır.
const BASELINE_COLOR = "var(--color-chart-budget)";
const SIMULATED_COLOR = "var(--color-chart-actual)";

interface ChartRow {
  date: string;
  label: string;
  baseline: number;
  simulated: number | null;
}

function renderTooltip(currency: string) {
  return function BalanceTooltip({ active, payload, label }: TooltipContentProps) {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="rounded-md border border-rule bg-surface px-3 py-2 text-xs shadow-sm">
        <p className="font-medium text-ink">{label}</p>
        {payload
          .filter((p) => p.value !== null && p.value !== undefined)
          .map((p, i) => (
            <p key={i} className="tabular mt-0.5" style={{ color: p.color }}>
              {p.name}: {formatAmount(Number(p.value), currency)}
            </p>
          ))}
      </div>
    );
  };
}

/**
 * Taban çizgi ve simüle edilmiş kümülatif bakiye eğrisi.
 *
 * `ReferenceLine y={0}` KRİTİKTİR: bu grafiğin cevapladığı soru "eğri ne
 * zaman sıfırın altına iniyor?"dur, mutlak yükseklik değil. En düşük bakiye
 * gününe `ReferenceDot` konur — kullanıcının spot kredi tarihini seçerken
 * baktığı tek nokta odur.
 */
export function BalanceCurveChart({
  baseline,
  simulated,
  summary,
  currency,
}: {
  baseline: ProjectionBucket[];
  simulated: ProjectionBucket[] | null;
  summary: ProjectionSummary;
  currency: string;
}) {
  const simulatedByDate = new Map(simulated?.map((b) => [b.date, b]) ?? []);
  const data: ChartRow[] = baseline.map((bucket) => ({
    date: bucket.date,
    label: formatDateTr(bucket.date),
    baseline: bucket.closingBalance,
    simulated: simulatedByDate.get(bucket.date)?.closingBalance ?? null,
  }));

  const minPoint = data.find((d) => d.date === summary.baselineMinDate);

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-rule)" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="var(--color-muted)"
            tickLine={false}
            axisLine={{ stroke: "var(--color-rule)" }}
            tick={{ fontSize: 11 }}
            minTickGap={40}
          />
          <YAxis
            stroke="var(--color-muted)"
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => formatCompactAmount(v)}
          />
          <Tooltip content={renderTooltip(currency)} />
          <Legend
            verticalAlign="top"
            align="right"
            height={32}
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, color: "var(--color-muted)" }}
          />
          {/* Sıfır çizgisi — ödeme gücü eşiği. */}
          <ReferenceLine y={0} stroke="var(--color-brick)" strokeDasharray="4 4" />
          {minPoint ? (
            <ReferenceDot
              x={minPoint.label}
              y={minPoint.baseline}
              r={4}
              fill="var(--color-brick)"
              stroke="none"
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="baseline"
            name="Taban Çizgi"
            stroke={BASELINE_COLOR}
            strokeWidth={2}
            strokeLinecap="round"
            dot={false}
            isAnimationActive={false}
          />
          {simulated ? (
            <Line
              type="monotone"
              dataKey="simulated"
              name="Simülasyon"
              stroke={SIMULATED_COLOR}
              strokeWidth={2}
              strokeDasharray="6 4"
              strokeLinecap="round"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
