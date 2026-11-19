import {
  LayoutDashboard, Search, Users, KeyRound, Sparkles, Gauge, GitCompareArrows, Crosshair,
  Link2, Split, ShieldCheck, Bug, History, ListOrdered, Settings, type LucideIcon,
} from "lucide-react";

export type ToolId =
  | "domain-overview" | "organic-research" | "organic-competitors" | "keyword-overview"
  | "keyword-magic-tool" | "keyword-difficulty" | "keyword-gap" | "position-tracking"
  | "backlink-analytics" | "backlink-gap" | "backlink-audit"
  | "site-audit" | "historical-trends" | "serp-analysis";

/** What the universal header search box expects on this tool. */
export type QueryKind = "domain" | "keyword" | "keywords" | "domains" | "project" | "none";

/** Phase-2 integration status for each tool. Only "live" tools may call DataForSEO. */
export type IntegrationStatus = "mock" | "ready" | "live";

export type ToolDef = {
  id: ToolId;
  label: string;
  section: "seo" | "links" | "site";
  href: string;
  icon: LucideIcon;
  query: QueryKind;
  placeholder: string;
  description: string;
  /** Integration order from the project plan (1 = first). */
  order: number;
  /** DataForSEO endpoints this tool will use (documented in docs/INTEGRATION.md). */
  endpoints: string[];
  integration: IntegrationStatus;
};

export const TOOLS: ToolDef[] = [
  {
    id: "domain-overview", label: "Domain Overview", section: "seo", href: "/seo/domain-overview",
    icon: LayoutDashboard, query: "domain", placeholder: "Enter domain, e.g. example.com",
    description: "Estimated organic & paid visibility, keyword distribution, competitors and backlink profile for a domain.",
    order: 1, integration: "ready",
    endpoints: [
      "POST /v3/dataforseo_labs/google/domain_rank_overview/live",
      "POST /v3/dataforseo_labs/google/historical_rank_overview/live",
      "POST /v3/dataforseo_labs/google/ranked_keywords/live",
      "POST /v3/dataforseo_labs/google/competitors_domain/live",
      "POST /v3/backlinks/summary/live",
    ],
  },
  {
    id: "organic-research", label: "Organic Research", section: "seo", href: "/seo/organic-research",
    icon: Search, query: "domain", placeholder: "Enter domain or URL",
    description: "Keywords a domain ranks for in Google's organic results, with positions, volumes and estimated traffic.",
    order: 2, integration: "ready",
    endpoints: [
      "POST /v3/dataforseo_labs/google/ranked_keywords/live",
      "POST /v3/dataforseo_labs/google/relevant_pages/live",
      "POST /v3/dataforseo_labs/google/domain_rank_overview/live",
      "POST /v3/dataforseo_labs/google/historical_rank_overview/live",
    ],
  },
  {
    id: "organic-competitors", label: "Organic Competitors", section: "seo", href: "/seo/organic-competitors",
    icon: Users, query: "domain", placeholder: "Enter domain",
    description: "Domains competing for the same organic keywords.",
    order: 5, integration: "ready",
    endpoints: ["POST /v3/dataforseo_labs/google/competitors_domain/live", "POST /v3/dataforseo_labs/google/domain_rank_overview/live"],
  },
  {
    id: "keyword-overview", label: "Keyword Overview", section: "seo", href: "/seo/keyword-overview",
    icon: KeyRound, query: "keyword", placeholder: "Enter keyword",
    description: "Search volume, trend, CPC, difficulty, intent and SERP for a keyword.",
    order: 3, integration: "ready",
    endpoints: [
      "POST /v3/dataforseo_labs/google/keyword_overview/live",
      "POST /v3/dataforseo_labs/google/keyword_suggestions/live",
      "POST /v3/serp/google/organic/live/advanced",
    ],
  },
  {
    id: "keyword-magic-tool", label: "Keyword Magic Tool", section: "seo", href: "/seo/keyword-magic-tool",
    icon: Sparkles, query: "keyword", placeholder: "Enter seed keyword",
    description: "Expand a seed keyword into broad, phrase and related keyword ideas with filters.",
    order: 4, integration: "ready",
    endpoints: [
      "POST /v3/dataforseo_labs/google/keyword_suggestions/live",
      "POST /v3/dataforseo_labs/google/related_keywords/live",
      "POST /v3/dataforseo_labs/google/keyword_ideas/live",
    ],
  },
  {
    id: "keyword-difficulty", label: "Keyword Difficulty", section: "seo", href: "/seo/keyword-difficulty",
    icon: Gauge, query: "keywords", placeholder: "Enter up to 100 keywords, comma separated",
    description: "Bulk keyword difficulty scores (0–100) for a list of keywords.",
    order: 3, integration: "ready",
    endpoints: ["POST /v3/dataforseo_labs/google/keyword_overview/live"],
  },
  {
    id: "keyword-gap", label: "Keyword Gap", section: "seo", href: "/seo/keyword-gap",
    icon: GitCompareArrows, query: "domains", placeholder: "Your domain vs competitor",
    description: "Compare organic keyword portfolios between domains: shared, missing, weak and unique.",
    order: 6, integration: "ready",
    endpoints: ["POST /v3/dataforseo_labs/google/domain_intersection/live", "POST /v3/dataforseo_labs/google/domain_rank_overview/live"],
  },
  {
    id: "position-tracking", label: "Position Tracking", section: "seo", href: "/seo/position-tracking",
    icon: Crosshair, query: "domain", placeholder: "Enter tracked domain",
    description: "Track Google positions for a keyword set over time from stored daily SERP checks.",
    order: 7, integration: "mock",
    endpoints: ["POST /v3/serp/google/organic/task_post", "GET /v3/serp/google/organic/tasks_ready", "GET /v3/serp/google/organic/task_get/advanced/{id}"],
  },
  {
    id: "backlink-analytics", label: "Backlink Analytics", section: "links", href: "/links/backlink-analytics",
    icon: Link2, query: "domain", placeholder: "Enter domain or URL",
    description: "Backlinks, referring domains, anchors and link history for a target.",
    order: 8, integration: "ready",
    endpoints: [
      "POST /v3/backlinks/summary/live", "POST /v3/backlinks/backlinks/live", "POST /v3/backlinks/referring_domains/live",
      "POST /v3/backlinks/anchors/live", "POST /v3/backlinks/history/live",
    ],
  },
  {
    id: "backlink-gap", label: "Backlink Gap", section: "links", href: "/links/backlink-gap",
    icon: Split, query: "domains", placeholder: "Your domain vs competitors",
    description: "Referring domains that link to competitors but not to you.",
    order: 9, integration: "ready",
    endpoints: ["POST /v3/backlinks/domain_intersection/live"],
  },
  {
    id: "backlink-audit", label: "Backlink Audit", section: "links", href: "/links/backlink-audit",
    icon: ShieldCheck, query: "domain", placeholder: "Enter domain",
    description: "Review referring domains by spam score and link attributes to find risky links.",
    order: 10, integration: "ready",
    endpoints: ["POST /v3/backlinks/referring_domains/live", "POST /v3/backlinks/bulk_spam_score/live"],
  },
  {
    id: "site-audit", label: "Site Audit", section: "site", href: "/site/site-audit",
    icon: Bug, query: "domain", placeholder: "Enter domain to crawl",
    description: "Crawl a site and report technical SEO issues by severity.",
    order: 11, integration: "mock",
    endpoints: ["POST /v3/on_page/task_post", "POST /v3/on_page/summary/{id}", "POST /v3/on_page/pages", "POST /v3/on_page/duplicate_tags", "POST /v3/on_page/links"],
  },
  {
    id: "historical-trends", label: "Historical Domain Trends", section: "site", href: "/site/historical-trends",
    icon: History, query: "domain", placeholder: "Enter domain",
    description: "Month-by-month organic visibility history from the provider's historical data and stored snapshots.",
    order: 12, integration: "ready",
    endpoints: ["POST /v3/dataforseo_labs/google/historical_rank_overview/live", "POST /v3/backlinks/history/live"],
  },
  {
    id: "serp-analysis", label: "SERP Analysis", section: "site", href: "/site/serp-analysis",
    icon: ListOrdered, query: "keyword", placeholder: "Enter keyword",
    description: "Live Google results page for a keyword: organic results, SERP features and ranking domains.",
    order: 13, integration: "ready",
    endpoints: ["POST /v3/serp/google/organic/live/advanced", "POST /v3/backlinks/bulk_ranks/live (optional)"],
  },
];

export const NAV_SECTIONS: { id: ToolDef["section"]; label: string }[] = [
  { id: "seo", label: "SEO Research" },
  { id: "links", label: "Link Building" },
  { id: "site", label: "Website Analysis" },
];

export const SETTINGS_NAV = { label: "Settings", href: "/settings", icon: Settings };

export function getTool(id: ToolId): ToolDef {
  const t = TOOLS.find((t) => t.id === id);
  if (!t) throw new Error(`Unknown tool ${id}`);
  return t;
}

export function toolByPath(pathname: string): ToolDef | undefined {
  return TOOLS.find((t) => pathname.startsWith(t.href));
}
