"use client";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { SERIES } from "./palette";
import { ChartTooltip } from "./chart-tooltip";
import { fmtCompact } from "@/lib/utils";

export function DonutChart({ data, height = 180, centerLabel, centerValue, valueFormatter = fmtCompact }: {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
  valueFormatter?: (v: number) => string;
}) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="100%" paddingAngle={1.5} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
              {data.map((d, i) => <Cell key={d.name} fill={d.color ?? SERIES[i]} />)}
            </Pie>
            <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
          </PieChart>
        </ResponsiveContainer>
        {centerValue && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-lg font-semibold text-ink tabular">{centerValue}</div>
              {centerLabel && <div className="text-[11px] text-ink-3">{centerLabel}</div>}
            </div>
          </div>
        )}
      </div>
      <ul className="min-w-[140px] flex-1 space-y-1.5">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2 text-[12.5px]">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: d.color ?? SERIES[i] }} />
            <span className="text-ink-2">{d.name}</span>
            <span className="ml-auto font-semibold text-ink tabular">{((d.value / total) * 100).toFixed(1)}%</span>
            <span className="w-12 text-right text-ink-3 tabular">{valueFormatter(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
