"use client";
import Link from "next/link";
import { AlertTriangle, CloudOff, KeyRound, Inbox, Wallet, Timer, SearchX, RefreshCw, FlaskConical } from "lucide-react";
import type { ReportErrorCode } from "@/lib/reports/envelope";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, icon: Icon = Inbox, action, className, compact }: {
  title: string; description?: React.ReactNode; icon?: React.ComponentType<{ className?: string }>; action?: React.ReactNode; className?: string; compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-8" : "py-16", className)}>
      <div className="mb-3 grid size-10 place-items-center rounded-full bg-page text-ink-3">
        <Icon className="size-5" />
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-[13px] text-ink-2">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const ERROR_COPY: Record<ReportErrorCode, { title: string; icon: React.ComponentType<{ className?: string }>; hint?: string; settings?: boolean }> = {
  VALIDATION_ERROR: { title: "Check your input", icon: SearchX },
  NOT_CONFIGURED: { title: "DataForSEO is not connected", icon: KeyRound, hint: "Add your API login and password in Settings to load live data.", settings: true },
  LIVE_DISABLED: { title: "Live data is not enabled for this tool", icon: FlaskConical, hint: "Enable live mode for this tool in your environment configuration.", settings: true },
  API_UNAVAILABLE: { title: "Data provider unavailable", icon: CloudOff, hint: "DataForSEO could not be reached. This is usually temporary — try again shortly." },
  RATE_LIMITED: { title: "Too many requests", icon: Timer, hint: "The request rate limit was reached. Wait a minute and retry." },
  BUDGET_EXCEEDED: { title: "Spending limit reached", icon: Wallet, hint: "Raise the limit in Settings → Usage & limits, or wait for the next period.", settings: true },
  INSUFFICIENT_FUNDS: { title: "Provider balance too low", icon: Wallet, hint: "Top up your DataForSEO account balance.", settings: true },
  PROVIDER_ERROR: { title: "The provider returned an error", icon: AlertTriangle },
  NOT_FOUND: { title: "Not found", icon: SearchX },
  INTERNAL: { title: "Something went wrong", icon: AlertTriangle },
};

export function ErrorState({ code, message, onRetry, className }: { code: ReportErrorCode; message: string; onRetry?: () => void; className?: string }) {
  const c = ERROR_COPY[code] ?? ERROR_COPY.INTERNAL;
  const Icon = c.icon;
  const tone = code === "API_UNAVAILABLE" || code === "RATE_LIMITED" ? "warning" : code === "VALIDATION_ERROR" ? "muted" : "critical";
  return (
    <Card className={cn("flex flex-col items-center px-6 py-14 text-center", className)} role="alert">
      <div className={cn("mb-3 grid size-11 place-items-center rounded-full", tone === "critical" ? "bg-[#fbe5e5] text-critical" : tone === "warning" ? "bg-[#fff4d6] text-[#a66d00]" : "bg-page text-ink-3")}>
        <Icon className="size-5" />
      </div>
      <p className="text-[15px] font-semibold text-ink">{c.title}</p>
      <p className="mt-1 max-w-lg text-[13px] text-ink-2">{message}</p>
      {c.hint && <p className="mt-1 max-w-lg text-[13px] text-ink-3">{c.hint}</p>}
      <div className="mt-5 flex gap-2">
        {onRetry && code !== "VALIDATION_ERROR" && (
          <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw /> Try again</Button>
        )}
        {c.settings && <Button asChild size="sm"><Link href="/settings">Open Settings</Link></Button>}
      </div>
      <p className="mt-4 font-mono text-[11px] text-ink-3">{code}</p>
    </Card>
  );
}

/** Skeleton approximating a dashboard: KPI row, chart, two tables. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading report">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-7 w-20" /><Skeleton className="mt-3 h-3 w-16" /></Card>
        ))}
      </div>
      <Card className="p-5"><Skeleton className="h-4 w-48" /><Skeleton className="mt-4 h-64 w-full" /></Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="space-y-3 p-5">
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} className="h-6 w-full" />)}
          </Card>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
    </div>
  );
}
