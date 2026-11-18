"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CircleDollarSign, FlaskConical, OctagonAlert, RefreshCw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS } from "@/components/charts/palette";
import { cn, fmtCurrency } from "@/lib/utils";

export type MeterResponse = {
  meter: null | {
    todayUsd: number;
    monthUsd: number;
    paidRequestsToday: number;
    paidRequestsMonth: number;
    cacheHitsToday: number;
    savedTodayUsd: number;
    lastPaidAt: string | null;
    recent: { id: string; createdAt: string; tool: string | null; endpoint: string; cacheHit: boolean; costUsd: number; error: string | null }[];
    dayStartsAt: string;
  };
  limits: { dailyUsd: number; monthlyUsd: number; maxRequestUsd: number; hardStop: boolean };
  balance: { usd: number | null; checkedAt: string | null };
  live: { enabled: boolean; sandbox: boolean; tools: string[] };
  databaseAvailable: boolean;
};

export const METER_KEY = ["usage-meter"] as const;

/** Spend precision: show 4 decimals under $1 so single requests (~$0.01) are visible. */
const usd = (n: number) => fmtCurrency(n, n < 1 ? 4 : 2);

function level(spent: number, limit: number): "ok" | "near" | "over" {
  if (limit <= 0) return spent > 0 ? "over" : "ok";
  const r = spent / limit;
  return r >= 1 ? "over" : r >= 0.8 ? "near" : "ok";
}

export function useUsageMeter() {
  return useQuery<MeterResponse>({
    queryKey: METER_KEY,
    queryFn: () => fetch("/api/usage/meter").then((r) => r.json()),
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });
}

/**
 * Header spend meter. Values are the actual per-request costs DataForSEO reports, summed from the
 * request log; they update after every live report and every 20 s.
 */
export function UsageMeter({ className }: { className?: string }) {
  const { data } = useUsageMeter();
  const qc = useQueryClient();
  const [delta, setDelta] = useState<number | null>(null);
  const prev = useRef<number | null>(null);
  const [checking, setChecking] = useState(false);

  const today = data?.meter?.todayUsd ?? 0;
  const loaded = Boolean(data?.meter);
  useEffect(() => {
    // Only flash increases that happen while the page is open (not the first load).
    if (!loaded) return;
    if (prev.current != null && today > prev.current + 1e-9) {
      setDelta(today - prev.current);
      const t = setTimeout(() => setDelta(null), 4000);
      prev.current = today;
      return () => clearTimeout(t);
    }
    prev.current = today;
  }, [today, loaded]);

  if (!data) return <div className={cn("hidden h-8 w-28 animate-pulse rounded-md bg-page sm:block", className)} />;

  const live = data.live.enabled;
  const m = data.meter;
  const dayLevel = level(today, data.limits.dailyUsd);
  const monthLevel = level(m?.monthUsd ?? 0, data.limits.monthlyUsd);
  const worst = dayLevel === "over" || monthLevel === "over" ? "over" : dayLevel === "near" || monthLevel === "near" ? "near" : "ok";
  const pct = Math.min(100, (today / Math.max(1e-9, data.limits.dailyUsd)) * 100);

  async function refreshBalance() {
    setChecking(true);
    try {
      const res = await fetch("/api/settings/credentials/test", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error?.message ?? "Balance check failed");
      toast.success(`DataForSEO balance: ${fmtCurrency(body.balanceUsd)}`);
      qc.invalidateQueries({ queryKey: METER_KEY });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative hidden h-9 items-center gap-2 overflow-hidden rounded-md border px-2.5 text-xs font-semibold sm:flex",
            !live ? "border-[#f3d27a] bg-[#fff4d6] text-[#7a5300]" : worst === "over" ? "border-[#efb4b4] bg-[#fbe5e5] text-[#a12424]" : worst === "near" ? "border-[#f3d27a] bg-[#fff8e6] text-[#7a5300]" : "border-border-strong bg-surface text-ink",
            className,
          )}
          aria-label="API spend meter"
        >
          {!live ? <FlaskConical className="size-3.5" /> : worst === "over" ? <OctagonAlert className="size-3.5" /> : worst === "near" ? <AlertTriangle className="size-3.5" /> : <CircleDollarSign className="size-3.5 text-good-text" />}
          {live ? (
            <span className="tabular">
              {usd(today)} <span className="font-normal text-ink-3">today</span>
            </span>
          ) : (
            <span>Mock data · $0</span>
          )}
          {delta != null && (
            <span className="animate-pulse rounded bg-brand-soft px-1 text-[10.5px] text-brand tabular" aria-live="polite">+{usd(delta)}</span>
          )}
          {live && (
            <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#eceef2]">
              <span className="block h-full" style={{ width: `${pct}%`, background: dayLevel === "over" ? STATUS.critical : dayLevel === "near" ? STATUS.warning : STATUS.good }} />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-semibold text-ink">DataForSEO spend</div>
          <Badge variant={live ? "live" : "mock"}>{live ? (data.live.sandbox ? "Sandbox" : "Live") : "Mock mode"}</Badge>
        </div>

        {!data.databaseAvailable ? (
          <p className="px-4 py-4 text-[13px] text-ink-2">Database not connected — spend can't be recorded. Live requests are still capped per request.</p>
        ) : (
          <div className="space-y-4 px-4 py-4">
            {!live && <p className="text-[12.5px] text-ink-2">All reports are using mock data, so nothing is being spent. Live tools will appear here once enabled.</p>}
            <Gauge label="Today" spent={today} limit={data.limits.dailyUsd} lvl={dayLevel} sub={`${m?.paidRequestsToday ?? 0} paid requests · resets 00:00 UTC`} />
            <Gauge label="This month" spent={m?.monthUsd ?? 0} limit={data.limits.monthlyUsd} lvl={monthLevel} sub={`${m?.paidRequestsMonth ?? 0} paid requests`} />
            <div className="grid grid-cols-2 gap-3 rounded-md bg-page p-3 text-[12px]">
              <div>
                <div className="text-ink-3">Cache hits today</div>
                <div className="font-semibold text-ink tabular">{m?.cacheHitsToday ?? 0}</div>
              </div>
              <div>
                <div className="text-ink-3">Saved by cache</div>
                <div className="font-semibold text-good-text tabular">{usd(m?.savedTodayUsd ?? 0)}</div>
              </div>
              <div className="col-span-2 flex items-center justify-between border-t border-border pt-2">
                <div>
                  <div className="text-ink-3">Account balance</div>
                  <div className="font-semibold text-ink tabular">
                    {data.balance.usd != null ? fmtCurrency(data.balance.usd) : "Unknown"}
                    {data.balance.checkedAt && <span className="ml-1.5 font-normal text-ink-3">as of {new Date(data.balance.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
                  </div>
                </div>
                <Button size="xs" variant="outline" onClick={refreshBalance} disabled={checking || !live} title="Free request (appendix/user_data)">
                  <RefreshCw className={cn(checking && "animate-spin")} /> Check
                </Button>
              </div>
            </div>
            {m && m.recent.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Latest requests</div>
                <ul className="space-y-1 text-[12px]">
                  {m.recent.map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-ink-3 tabular">{new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                      <span className="min-w-0 flex-1 truncate text-ink-2" title={r.endpoint}>{endpointLabel(r.endpoint)}</span>
                      <span className={cn("shrink-0 tabular", r.error ? "text-critical" : r.cacheHit ? "text-good-text" : "text-ink")}>
                        {r.error ? "error" : r.cacheHit ? "cached" : usd(r.costUsd)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
          <span className="text-[11px] text-ink-3">Amounts are DataForSEO-reported costs.</span>
          <Link href="/settings?tab=usage" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-medium text-brand hover:underline">
            Details & limits <ArrowRight className="size-3" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** "/v3/dataforseo_labs/google/keyword_overview/live" → "Labs · keyword overview" */
function endpointLabel(path: string): string {
  const parts = path.replace(/^\/v3\//, "").split("/").filter((p) => !["live", "advanced", "google", "task_post"].includes(p));
  const group = parts[0] === "dataforseo_labs" ? "Labs" : parts[0] === "serp" ? "SERP" : parts[0] === "backlinks" ? "Backlinks" : parts[0] === "on_page" ? "OnPage" : "Account";
  return `${group} · ${(parts.slice(1).join(" ") || parts[0]).replace(/_/g, " ")}`;
}

function Gauge({ label, spent, limit, lvl, sub }: { label: string; spent: number; limit: number; lvl: "ok" | "near" | "over"; sub: string }) {
  const pct = Math.min(100, (spent / Math.max(1e-9, limit)) * 100);
  const color = lvl === "over" ? STATUS.critical : lvl === "near" ? STATUS.warning : STATUS.good;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12.5px]">
        <span className="font-medium text-ink">{label}</span>
        <span className="tabular">
          <b className="text-ink">{usd(spent)}</b> <span className="text-ink-3">of {fmtCurrency(limit)}</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-[#eceef2]" role="meter" aria-valuenow={spent} aria-valuemax={limit} aria-label={`${label} spend`}>
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-ink-3">
        <span>{sub}</span>
        {lvl !== "ok" && (
          <span className={cn("inline-flex items-center gap-1 font-semibold", lvl === "over" ? "text-critical" : "text-[#7a5300]")}>
            {lvl === "over" ? <OctagonAlert className="size-3" /> : <AlertTriangle className="size-3" />}
            {lvl === "over" ? "Limit reached" : "Near limit"}
          </span>
        )}
      </div>
    </div>
  );
}
