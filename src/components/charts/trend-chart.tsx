"use client";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART, SERIES } from "./palette";
import { ChartLegend, ChartTooltip } from "./chart-tooltip";
import { fmtCompact, fmtDate } from "@/lib/utils";

export type SeriesDef = { key: string; label: string; color?: string };

/**
 * Time-series chart with one y-axis. Multiple series share the axis — pass only series of the
 * same unit (never mix e.g. traffic and keyword counts; render two charts instead).
 */
export function TrendChart<T extends Record<string, unknown>>({
  data, series, xKey = "date", height = 260, variant = "area", valueFormatter = (v: number) => fmtCompact(v),
  dateFormat = { month: "short", year: "2-digit" }, stacked = false, legend,
}: {
  data: T[];
  series: SeriesDef[];
  xKey?: string;
  height?: number;
  variant?: "area" | "line";
  valueFormatter?: (v: number) => string;
  dateFormat?: Intl.DateTimeFormatOptions;
  stacked?: boolean;
  legend?: boolean;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? SERIES[i] }));
  const visible = colored.filter((s) => !hidden.has(s.key));
  const toggle = (k: string) => setHidden((h) => {
    const n = new Set(h);
    if (n.has(k)) n.delete(k);
    else if (n.size < colored.length - 1) n.add(k);
    return n;
  });
  const showLegend = legend ?? colored.length > 1;
  // With gaps (null months), a lone month between two gaps has no line segment — show point markers.
  const hasGaps = data.some((row) => colored.some((s) => row[s.key] == null));
  const dot = (color: string) => (hasGaps ? { r: 2.5, strokeWidth: 0, fill: color } : false);
  const fmtX = (v: string) => fmtDate(v, dateFormat);
  const common = {
    data,
    margin: { top: 8, right: 8, left: 0, bottom: 0 },
  };
  const axes = (
    <>
      <CartesianGrid stroke={CHART.grid} strokeDasharray="0" vertical={false} />
      <XAxis dataKey={xKey} tickFormatter={fmtX} tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={{ stroke: CHART.axis }} tickLine={false} minTickGap={24} />
      <YAxis tickFormatter={(v) => valueFormatter(Number(v))} tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
      <Tooltip cursor={{ stroke: CHART.axis, strokeWidth: 1 }} content={<ChartTooltip labelFormatter={(l) => fmtDate(l, { month: "long", year: "numeric", day: dateFormat.day ? "numeric" : undefined })} valueFormatter={valueFormatter} />} />
    </>
  );
  return (
    <div className="w-full">
      {showLegend && <div className="mb-3"><ChartLegend items={colored} hidden={hidden} onToggle={toggle} /></div>}
      <div style={{ height }} role="img" aria-label={`Chart of ${colored.map((s) => s.label).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          {variant === "area" ? (
            <AreaChart {...common}>
              <defs>
                {visible.map((s) => (
                  <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={stacked ? 0.85 : 0.22} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={stacked ? 0.7 : 0.02} />
                  </linearGradient>
                ))}
              </defs>
              {axes}
              {visible.map((s) => (
                <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} stackId={stacked ? "1" : undefined} dot={dot(s.color)} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} isAnimationActive={false} />
              ))}
            </AreaChart>
          ) : (
            <LineChart {...common}>
              {axes}
              {visible.map((s) => (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={dot(s.color)} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} isAnimationActive={false} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
