"use client";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, SERIES } from "./palette";
import { ChartTooltip, ChartLegend } from "./chart-tooltip";
import { fmtCompact, fmtDate } from "@/lib/utils";

/** Vertical bars on a category or date axis; stacked when multiple series are passed. */
export function VBarChart<T extends Record<string, unknown>>({ data, xKey, series, height = 220, colors, isDate = false, valueFormatter = fmtCompact, stacked = true }: {
  data: T[];
  xKey: string;
  series: { key: string; label: string; color?: string }[];
  height?: number;
  colors?: readonly string[];
  isDate?: boolean;
  valueFormatter?: (v: number) => string;
  stacked?: boolean;
}) {
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? SERIES[i] }));
  return (
    <div>
      {colored.length > 1 && <div className="mb-3"><ChartLegend items={colored} /></div>}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey={xKey} tickFormatter={isDate ? (v) => fmtDate(v, { month: "short" }) : undefined} tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={{ stroke: CHART.axis }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={(v) => valueFormatter(Number(v))} tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip cursor={{ fill: "rgba(20,23,31,0.04)" }} content={<ChartTooltip labelFormatter={isDate ? (l) => fmtDate(l, { month: "long", year: "numeric" }) : undefined} valueFormatter={valueFormatter} />} />
            {colored.map((s, si) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} stackId={stacked ? "a" : undefined} radius={si === colored.length - 1 || !stacked ? [4, 4, 0, 0] : 0} stroke="#fff" strokeWidth={stacked ? 1 : 0} isAnimationActive={false}>
                {colors && colored.length === 1 && data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
