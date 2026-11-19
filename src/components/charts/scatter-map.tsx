"use client";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Cell } from "recharts";
import { CHART, SERIES } from "./palette";
import { fmtCompact } from "@/lib/utils";

/**
 * Explicit log-axis domain + ticks. Recharts' automatic ticks on a log scale can repeat a value
 * for narrow ranges (duplicate React keys), so ticks are generated here: 1-2-5 steps per decade,
 * thinned to powers of ten when there would be too many. Always unique.
 */
export function logAxis(values: number[], maxTicks = 7): { domain: [number, number]; ticks: number[] } {
  const v = values.filter((x) => x > 0);
  const lo = Math.max(1, (v.length ? Math.min(...v) : 1) / 2);
  const hi = Math.max(lo * 10, (v.length ? Math.max(...v) : 10) * 2);
  const steps = (mults: number[]) => {
    const out: number[] = [];
    for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
      for (const m of mults) {
        const t = m * 10 ** e;
        if (t >= lo && t <= hi) out.push(t);
      }
    }
    return out;
  };
  let ticks = steps([1, 2, 5]);
  if (ticks.length > maxTicks) ticks = steps([1]);
  if (ticks.length < 2) ticks = [lo, hi].map((x) => Math.round(x));
  return { domain: [lo, hi], ticks: [...new Set(ticks)] };
}

/** Competitive positioning map: x = organic keywords, y = estimated traffic, bubble = common keywords. */
export function ScatterMap({ points, height = 300, xLabel = "Organic keywords", yLabel = "Est. organic traffic", highlight }: {
  points: { name: string; x: number; y: number; z?: number }[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
  highlight?: string;
}) {
  const xAxis = logAxis(points.map((p) => p.x));
  const yAxis = logAxis(points.map((p) => p.y));
  return (
    <div style={{ height }} role="img" aria-label="Competitive positioning map">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 16, bottom: 18, left: 0 }}>
          <CartesianGrid stroke={CHART.grid} />
          <XAxis type="number" dataKey="x" name={xLabel} scale="log" domain={xAxis.domain} ticks={xAxis.ticks} allowDataOverflow tickFormatter={(v) => fmtCompact(v)} tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={{ stroke: CHART.axis }} tickLine={false} label={{ value: xLabel, position: "insideBottom", offset: -10, fill: CHART.muted, fontSize: 11 }} />
          <YAxis type="number" dataKey="y" name={yLabel} scale="log" domain={yAxis.domain} ticks={yAxis.ticks} allowDataOverflow tickFormatter={(v) => fmtCompact(v)} tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
          <ZAxis type="number" dataKey="z" range={[60, 600]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload as { name: string; x: number; y: number; z?: number } | undefined;
              if (!p) return null;
              return (
                <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">
                  <div className="mb-1 font-semibold text-ink">{p.name}</div>
                  <div className="text-ink-2">{xLabel}: <b className="text-ink">{fmtCompact(p.x)}</b></div>
                  <div className="text-ink-2">{yLabel}: <b className="text-ink">{fmtCompact(p.y)}</b></div>
                  {p.z != null && <div className="text-ink-2">Common keywords: <b className="text-ink">{fmtCompact(p.z)}</b></div>}
                </div>
              );
            }}
          />
          <Scatter data={points} isAnimationActive={false}>
            {points.map((p) => (
              <Cell key={p.name} fill={p.name === highlight ? SERIES[1] : SERIES[0]} fillOpacity={0.75} stroke="#fff" strokeWidth={2} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
