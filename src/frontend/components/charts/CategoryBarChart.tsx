"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";

import { formatAmount, formatCompactAmount } from "@/frontend/lib/format";
import type { VarianceRow } from "@/shared/types";

// Dashboard'daki BudgetTrendChart ile AYNI jetonlar — uygulama genelinde
// "Bütçe" ve "Gerçekleşen" hep aynı iki rengi taşısın diye.
const BUDGET_COLOR = "var(--color-chart-budget)";
const ACTUAL_COLOR = "var(--color-chart-actual)";

function renderTooltip(currency: string) {
  return function BarTooltip({ active, payload, label }: TooltipContentProps) {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="rounded-md border border-rule bg-surface px-3 py-2 text-xs shadow-sm">
        <p className="font-medium text-ink">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="tabular mt-0.5" style={{ color: p.color }}>
            {p.name}: {formatAmount(Number(p.value), currency)}
          </p>
        ))}
      </div>
    );
  };
}

interface CategoryBarChartProps {
  rows: VarianceRow[];
  currency: string;
}

/** Kategori bazında Bütçe vs Gerçekleşen — Rapor ekranındaki kırılım grafiği. */
export function CategoryBarChart({ rows, currency }: CategoryBarChartProps) {
  const data = rows.map((r) => ({
    name: r.categoryName,
    Bütçe: r.budgetAmount,
    Gerçekleşen: r.actualAmount,
  }));

  return (
    <div style={{ height: Math.max(240, rows.length * 44) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 24, bottom: 0, left: 8 }}
        >
          <CartesianGrid stroke="var(--color-rule)" horizontal={false} />
          <XAxis
            type="number"
            stroke="var(--color-muted)"
            tickLine={false}
            axisLine={{ stroke: "var(--color-rule)" }}
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => formatCompactAmount(v)}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="var(--color-muted)"
            tickLine={false}
            axisLine={false}
            width={120}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            content={renderTooltip(currency)}
            cursor={{ fill: "var(--color-paper)" }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={32}
            iconType="square"
            wrapperStyle={{ fontSize: 12, color: "var(--color-muted)" }}
          />
          <Bar
            dataKey="Bütçe"
            fill={BUDGET_COLOR}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="Gerçekleşen"
            fill={ACTUAL_COLOR}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
