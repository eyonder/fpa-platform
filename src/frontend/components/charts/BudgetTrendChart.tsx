"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";

import { formatAmount, formatCompactAmount } from "@/frontend/lib/format";
import { MONTHS } from "@/shared/constants/months";
import type { DashboardMonthPoint } from "@/shared/types";

// dataviz becerisindeki doğrulanmış kategorik paletin 1. ve 3. yuvası —
// bkz. globals.css'teki --color-chart-* jetonlarının üstündeki not.
const BUDGET_COLOR = "var(--color-chart-budget)";
const ACTUAL_COLOR = "var(--color-chart-actual)";

interface ChartRow {
  label: string;
  month: number;
  budget: number;
  actual: number | null;
  forecast: number | null;
}

function renderTooltip(currency: string) {
  return function TrendTooltip({ active, payload, label }: TooltipContentProps) {
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

interface BudgetTrendChartProps {
  months: DashboardMonthPoint[];
  currency: string;
}

/**
 * Yıl içi Bütçe / Gerçekleşen / Tahmin eğrisi. Gerçekleşen ve Tahmin AYNI
 * rengi (Gerçekleşen) paylaşır — kavramsal olarak "yıl sonuna dair en iyi
 * tahminimiz" tek bir çizgidir, sadece bilinen kısım dolu, projekte edilen
 * kısım kesikli çizilir (bkz. dashboard.service.ts'teki sınır ayı notu).
 */
export function BudgetTrendChart({ months, currency }: BudgetTrendChartProps) {
  const data: ChartRow[] = months.map((m) => ({
    label: MONTHS[m.month - 1].label,
    month: m.month,
    budget: m.budget,
    actual: m.actual,
    forecast: m.forecast,
  }));

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
            tick={{ fontSize: 12 }}
          />
          <YAxis
            stroke="var(--color-muted)"
            tickLine={false}
            axisLine={false}
            width={56}
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
          <Line
            type="monotone"
            dataKey="budget"
            name="Bütçe"
            stroke={BUDGET_COLOR}
            strokeWidth={2}
            strokeLinecap="round"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            name="Gerçekleşen"
            stroke={ACTUAL_COLOR}
            strokeWidth={2}
            strokeLinecap="round"
            dot={{ r: 3, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            name="Tahmin"
            stroke={ACTUAL_COLOR}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="6 4"
            dot={{ r: 3, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
