"use client";
import { useState } from "react";
import type { ToolDef } from "@/lib/config/tools";
import { useSearchState } from "@/lib/client/use-search-state";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const EXAMPLES: Record<string, string[]> = {
  domain: ["example.com", "acme-tools.io", "northwind.com"],
  keyword: ["project management software", "crm for small business", "email marketing"],
  keywords: ["seo tools, keyword research, backlink checker, rank tracker"],
  domains: ["example.com, northwind.com, brightpath.io"],
};

/** Shown when a tool has no query yet: a focused input + examples + what the tool reports. */
export function ToolLanding({ tool }: { tool: ToolDef }) {
  const { setParams } = useSearchState();
  const [value, setValue] = useState("");
  const multi = tool.query === "keywords";
  const submit = (v: string) => v.trim() && setParams({ q: v.trim() });
  const Icon = tool.icon;
  return (
    <Card className="px-6 py-12">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-brand-soft text-brand">
          <Icon className="size-6" />
        </div>
        <h2 className="text-lg font-semibold text-ink">{tool.label}</h2>
        <p className="mt-1 text-sm text-ink-2">{tool.description}</p>
        <form
          className="mt-6 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            submit(value);
          }}
        >
          {multi ? (
            <Textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder={tool.placeholder} rows={4} />
          ) : (
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={tool.placeholder} className="h-10" autoFocus />
          )}
          <Button type="submit" size="lg" className="sm:self-start">Search</Button>
        </form>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-ink-3">
          <span>Try:</span>
          {(EXAMPLES[tool.query] ?? EXAMPLES.domain).map((ex) => (
            <button key={ex} onClick={() => submit(ex)} className="rounded-full border border-border bg-page px-2.5 py-1 text-ink-2 hover:border-border-strong hover:text-ink">
              {ex}
            </button>
          ))}
        </div>
        <div className="mt-8 border-t border-border pt-5 text-left">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            Data sources <Badge variant={tool.integration === "mock" ? "mock" : "default"}>{tool.integration === "mock" ? "Mock until integrated" : "Integration ready"}</Badge>
          </div>
          <ul className="space-y-1 font-mono text-[11.5px] text-ink-2">
            {tool.endpoints.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      </div>
    </Card>
  );
}
