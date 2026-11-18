"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { TOOLS, type ToolDef } from "@/lib/config/tools";
import { looksLikeDomain, normalizeDomain, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";

/**
 * Universal domain/keyword search. Detects input type; when the current tool accepts that type
 * the search stays on the tool, otherwise it routes to Domain Overview / Keyword Overview.
 */
export function UniversalSearch({ current, q, db, lang }: { current?: ToolDef; q: string; db: string; lang: string }) {
  const router = useRouter();
  const [value, setValue] = useState(q);
  const [target, setTarget] = useState<string>("auto");
  useEffect(() => setValue(q), [q]);

  const isDomain = looksLikeDomain(value);
  const detected = value.trim() ? (current?.query === "domains" && value.includes(",") ? "domains" : current?.query === "keywords" && value.includes(",") ? "keywords" : isDomain ? "domain" : "keyword") : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const raw = value.trim();
    if (!raw) return;
    let tool: ToolDef | undefined;
    if (target !== "auto") tool = TOOLS.find((t) => t.id === target);
    else if (current && (current.query === detected || (current.query === "keywords" && detected === "keyword") || (current.query === "domains" && detected === "domains"))) tool = current;
    else tool = TOOLS.find((t) => t.id === (isDomain ? "domain-overview" : "keyword-overview"));
    if (!tool) return;
    const qv = tool.query === "domain" ? normalizeDomain(raw) : raw;
    const params = new URLSearchParams({ q: qv, db, lang });
    router.push(`${tool.href}?${params.toString()}`);
  }

  const singleInputTools = TOOLS.filter((t) => t.query === "domain" || t.query === "keyword");

  return (
    <form onSubmit={submit} role="search" className="flex min-w-0 flex-1 items-center">
      <div className="relative flex min-w-0 flex-1 items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-ink-3" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={current?.placeholder ?? "Enter domain or keyword"}
          aria-label="Search domain or keyword"
          className="h-9 w-full min-w-0 rounded-l-md border border-r-0 border-border-strong bg-surface pl-9 pr-24 text-sm placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        {detected && (
          <span className={cn("pointer-events-none absolute right-2 rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide", detected.startsWith("domain") ? "bg-brand-soft text-brand" : "bg-[#efeafd] text-[#4b3bb0]")}>
            {detected}
          </span>
        )}
      </div>
      <Select value={target} onValueChange={setTarget}>
        <SelectTrigger aria-label="Search in tool" className="h-9 w-[150px] rounded-none border-l border-border-strong text-[13px] max-md:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">{current && current.query !== "none" ? `This tool` : "Auto-detect"}</SelectItem>
          <SelectGroup>
            <SelectLabel>Open in</SelectLabel>
            {singleInputTools.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button type="submit" className="h-9 rounded-l-none">Search</Button>
    </form>
  );
}
