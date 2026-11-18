"use client";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { SERIES } from "./palette";

export function Sparkline({ values, color = SERIES[0], height = 32 }: { values: number[]; color?: string; height?: number }) {
  const data = values.map((v, i) => ({ i, v }));
  const id = `sp-${Math.round(values.reduce((a, b) => a + b, 0)) % 100000}-${values.length}`;
  return (
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tiny bar-style sparkline for monthly search volume trend in table cells. */
export function MiniBars({ values, color = SERIES[0] }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-5 items-end gap-[2px]" aria-hidden>
      {values.map((v, i) => (
        <span key={i} className="w-[4px] rounded-t-[1px]" style={{ height: `${Math.max(8, (v / max) * 100)}%`, background: color, opacity: 0.85 }} />
      ))}
    </div>
  );
}
