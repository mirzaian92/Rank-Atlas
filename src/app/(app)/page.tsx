"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, KeyRound, Star, Trash2 } from "lucide-react";
import { NAV_SECTIONS, TOOLS } from "@/lib/config/tools";
import { APP_NAME } from "@/lib/config/site";
import { MARKETS } from "@/lib/config/markets";
import { recallMarket } from "@/lib/client/use-search-state";
import { normalizeDomain } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/states";

type Saved = { id: string; tool: string; query: string; locationCode: number; languageCode: string; createdAt: string };

export default function Home() {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [keyword, setKeyword] = useState("");
  const [market, setMarket] = useState({ db: "us", lang: "en" });
  useEffect(() => { const m = recallMarket(); if (m) setMarket(m); }, []);
  const qc = useQueryClient();
  const saved = useQuery<{ items: Saved[]; databaseAvailable: boolean }>({ queryKey: ["saved"], queryFn: () => fetch("/api/saved-searches").then((r) => r.json()) });

  const go = (href: string, q: string) => router.push(`${href}?${new URLSearchParams({ q, db: market.db, lang: market.lang })}`);

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Welcome to {APP_NAME}</h1>
        <p className="mt-1 text-sm text-ink-2">Research domains, keywords and backlinks. Start with a domain or a keyword.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Globe className="size-4 text-brand" />Analyze a domain</div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (domain.trim()) go("/seo/domain-overview", normalizeDomain(domain)); }}>
            <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" aria-label="Domain" />
            <Button type="submit">Analyze</Button>
          </form>
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><KeyRound className="size-4 text-brand" />Research a keyword</div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (keyword.trim()) go("/seo/keyword-overview", keyword.trim()); }}>
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="project management software" aria-label="Keyword" />
            <Button type="submit">Research</Button>
          </form>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {NAV_SECTIONS.map((s) => (
            <div key={s.id}>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{s.label}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {TOOLS.filter((t) => t.section === s.id).map((t) => {
                  const Icon = t.icon;
                  return (
                    <Link key={t.id} href={t.href} className="group rounded-lg border border-border bg-surface p-4 transition-colors hover:border-brand">
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-brand" />
                        <span className="text-sm font-semibold text-ink group-hover:text-brand">{t.label}</span>
                        <Badge variant={t.integration === "mock" ? "mock" : "default"} className="ml-auto">{t.integration === "mock" ? "Mock" : "Ready"}</Badge>
                      </div>
                      <p className="mt-1.5 text-[12.5px] leading-snug text-ink-2">{t.description}</p>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <Card className="h-fit">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3 text-sm font-semibold"><Star className="size-4 text-[#eda100]" />Saved searches</div>
          {saved.data?.items?.length ? (
            <ul className="divide-y divide-border">
              {saved.data.items.map((s) => {
                const tool = TOOLS.find((t) => t.id === s.tool);
                const m = MARKETS.find((x) => x.locationCode === s.locationCode);
                return (
                  <li key={s.id} className="flex items-center gap-2 px-5 py-2.5">
                    <Link className="min-w-0 flex-1" href={`${tool?.href}?${new URLSearchParams({ q: s.query, db: m?.id ?? "us", lang: s.languageCode })}`}>
                      <div className="truncate text-[13px] font-medium text-brand">{s.query}</div>
                      <div className="text-[11.5px] text-ink-3">{tool?.label} · {m?.flag} {m?.country}</div>
                    </Link>
                    <button
                      aria-label="Delete saved search"
                      className="text-ink-3 hover:text-critical"
                      onClick={async () => { await fetch(`/api/saved-searches?id=${s.id}`, { method: "DELETE" }); qc.invalidateQueries({ queryKey: ["saved"] }); }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState compact icon={Star} title={saved.data?.databaseAvailable === false ? "Database not connected" : "No saved searches"} description={saved.data?.databaseAvailable === false ? "Connect PostgreSQL to save searches." : "Use the Save button on any report."} />
          )}
        </Card>
      </div>
    </div>
  );
}
