"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Home } from "lucide-react";
import { NAV_SECTIONS, SETTINGS_NAV, TOOLS } from "@/lib/config/tools";
import { APP_NAME } from "@/lib/config/site";
import { cn } from "@/lib/utils";
import { Hint } from "@/components/ui/tooltip";

/** Carry market params across tools; carry the query only when the input type matches. */
function hrefFor(href: string, query: string, sp: URLSearchParams, currentKind: string | undefined) {
  const tool = TOOLS.find((t) => t.href === href);
  const next = new URLSearchParams();
  const db = sp.get("db");
  const lang = sp.get("lang");
  if (db) next.set("db", db);
  if (lang) next.set("lang", lang);
  const q = sp.get("q");
  if (q && tool && currentKind && tool.query === currentKind) next.set("q", q);
  const s = next.toString();
  return s ? `${href}?${s}` : href;
}

export function AppSidebar({ collapsed, onToggle, onNavigate }: { collapsed: boolean; onToggle?: () => void; onNavigate?: () => void }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = TOOLS.find((t) => pathname.startsWith(t.href));

  const item = (href: string, label: string, Icon: React.ComponentType<{ className?: string }>, active: boolean) => {
    const link = (
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(
          "group flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-colors",
          active ? "bg-nav-2 text-white" : "text-nav-ink hover:bg-nav-2/60 hover:text-white",
          collapsed && "justify-center px-0",
        )}
        aria-current={active ? "page" : undefined}
      >
        <Icon className={cn("size-[17px] shrink-0", active ? "text-[#7fb2ef]" : "text-nav-ink-2 group-hover:text-nav-ink")} />
        {!collapsed && <span className="truncate">{label}</span>}
        {active && !collapsed && <span className="ml-auto h-4 w-0.5 rounded-full bg-[#7fb2ef]" />}
      </Link>
    );
    return collapsed ? <Hint key={href} content={label} side="right">{link}</Hint> : <div key={href}>{link}</div>;
  };

  return (
    <nav aria-label="Main" className={cn("flex h-full flex-col bg-nav text-nav-ink", collapsed ? "w-[60px]" : "w-[240px]")}>
      <div className={cn("flex h-14 items-center gap-2 border-b border-white/5 px-4", collapsed && "justify-center px-0")}>
        <span className="grid size-7 place-items-center rounded-md bg-brand text-[13px] font-bold text-white">R</span>
        {!collapsed && <span className="text-[15px] font-semibold tracking-tight text-white">{APP_NAME}</span>}
      </div>
      <div className="nav-scroll flex-1 overflow-y-auto px-2 py-3">
        {item("/", "Home", Home, pathname === "/")}
        {NAV_SECTIONS.map((s) => (
          <div key={s.id} className="mt-4">
            {!collapsed ? (
              <div className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-nav-ink-2">{s.label}</div>
            ) : (
              <div className="mx-3 mb-2 h-px bg-white/10" />
            )}
            <div className="space-y-0.5">
              {TOOLS.filter((t) => t.section === s.id).map((t) =>
                item(hrefFor(t.href, "", sp, current?.query), t.label, t.icon, pathname.startsWith(t.href)),
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/5 px-2 py-2">
        {item(SETTINGS_NAV.href, SETTINGS_NAV.label, SETTINGS_NAV.icon, pathname.startsWith(SETTINGS_NAV.href))}
        {onToggle && (
          <button
            onClick={onToggle}
            className={cn("mt-1 flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] text-nav-ink-2 hover:bg-nav-2/60 hover:text-white", collapsed && "justify-center px-0")}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="size-[17px]" /> : <><ChevronsLeft className="size-[17px]" /><span>Collapse</span></>}
          </button>
        )}
      </div>
    </nav>
  );
}
