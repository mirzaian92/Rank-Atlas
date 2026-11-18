"use client";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Cell } from "recharts";
import { CHART, SERIES } from "./palette";
import { fmtCompact } from "@/lib/utils";

/** Competitive positioning map: x = organic keywords, y = estimated traffic, bubble = common keywords. */
export function ScatterMap({ points, height = 300, xLabel = "Organic keywords", yLabel = "Est. organic traffic", highlight }: {
  points: { name: string; x: number; y: number; z?: number }[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
  highlight?: string;
}) {
  return (
    <div style={{ height }} role="img" aria-label="Competitive positioning map">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 16, bottom: 18, left: 0 }}>
          <CartesianGrid stroke={CHART.grid} />
          <XAxis type="number" dataKey="x" name={xLabel} scale="log" domain={["auto", "auto"]} tickFormatter={(v) => fmtCompact(v)} tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={{ stroke: CHART.axis }} tickLine={false} label={{ value: xLabel, position: "insideBottom", offset: -10, fill: CHART.muted, fontSize: 11 }} />
          <YAxis type="number" dataKey="y" name={yLabel} scale="log" domain={["auto", "auto"]} tickFormatter={(v) => fmtCompact(v)} tick={{ fill: CHART.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
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
