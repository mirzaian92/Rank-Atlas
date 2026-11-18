import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn, fmtPercent } from "@/lib/utils";
import { InfoTip } from "./info-tip";
import { MockTag } from "./source-badge";

export function Delta({ value, invert = false, className }: { value: number | null; invert?: boolean; className?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className={cn("text-xs text-ink-3", className)}>—</span>;
  const up = value > 0;
  const good = invert ? !up : up;
  const flat = Math.abs(value) < 0.05;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold tabular", flat ? "text-ink-3" : good ? "text-good-text" : "text-[#b42318]", className)}>
      {!flat && (up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />)}
      {fmtPercent(Math.abs(value))}
    </span>
  );
}

export function MetricCard({ label, value, delta, deltaLabel, info, sub, mock, href, children, className, accent }: {
  label: string;
  value: React.ReactNode;
  delta?: number | null;
  deltaLabel?: string;
  info?: React.ReactNode;
  sub?: React.ReactNode;
  mock?: boolean;
  href?: string;
  children?: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-1.5">
        {accent && <span className="size-2 rounded-full" style={{ background: accent }} />}
        <span className="text-[12.5px] font-medium leading-tight text-ink-2">{label}</span>
        {info && <InfoTip content={info} />}
        {mock && <span className="ml-auto shrink-0"><MockTag /></span>}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[24px] font-semibold leading-none tracking-tight text-ink tabular">{value}</span>
        {delta !== undefined && <Delta value={delta} />}
      </div>
      {(sub || deltaLabel) && <div className="mt-1.5 text-[11.5px] text-ink-3">{sub ?? deltaLabel}</div>}
      {children && <div className="mt-3">{children}</div>}
    </>
  );
  return (
    <Card className={cn("p-4", href && "transition-colors hover:border-border-strong", className)}>
      {href ? <a href={href} className="block">{body}</a> : body}
    </Card>
  );
}
