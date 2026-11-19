/** DataForSEO Backlinks API → normalized UI types. Pure functions. */
import type { AnchorRow, BacklinkRow, BacklinkSummary, ReferringDomainRow } from "@/lib/reports/types";
import type {
  DfsAnchorItem, DfsBacklinkItem, DfsBacklinksHistoryItem, DfsBacklinksSummary, DfsBlIntersectionEntry, DfsBlIntersectionItem, DfsReferringDomainItem,
} from "../types";
import { num, numOrNull } from "./common";

/** "2026-10-01 00:00:00 +00:00" → ISO string (or null). */
export function dfsDate(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = new Date(v.replace(" +00:00", "Z").replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function normalizeBacklink(it: DfsBacklinkItem): BacklinkRow {
  return {
    sourceUrl: it.url_from,
    sourceTitle: it.page_from_title ?? null,
    sourceDomainRank: numOrNull(it.domain_from_rank),
    targetUrl: it.url_to,
    anchor: it.anchor || null,
    dofollow: Boolean(it.dofollow),
    type: it.item_type ?? "anchor",
    firstSeen: dfsDate(it.first_seen),
    lastSeen: dfsDate(it.last_seen),
    isNew: Boolean(it.is_new),
    isLost: Boolean(it.is_lost),
  };
}

export function normalizeReferringDomain(it: DfsReferringDomainItem): ReferringDomainRow {
  const backlinks = num(it.backlinks);
  return {
    domain: it.domain,
    domainRank: numOrNull(it.rank),
    backlinks,
    dofollow: Math.max(0, backlinks - num(it.referring_links_attributes?.nofollow)),
    firstSeen: dfsDate(it.first_seen),
    spamScore: numOrNull(it.backlinks_spam_score),
    country: null, // not part of referring_domains items
  };
}

export function normalizeAnchor(it: DfsAnchorItem): AnchorRow {
  const backlinks = num(it.backlinks);
  return {
    anchor: it.anchor ?? "",
    backlinks,
    referringDomains: num(it.referring_domains),
    dofollowShare: backlinks > 0 ? Math.round(((backlinks - num(it.referring_links_attributes?.nofollow)) / backlinks) * 100) : null,
    firstSeen: dfsDate(it.first_seen),
  };
}

const LINK_TYPE_LABEL: Record<string, string> = { anchor: "Text", image: "Image", redirect: "Redirect", canonical: "Canonical", link: "Link", meta: "Meta", alternate: "Alternate" };

export function normalizeBacklinkSummary(target: string, s: DfsBacklinksSummary | null, history: DfsBacklinksHistoryItem[]): BacklinkSummary {
  const backlinks = num(s?.backlinks);
  const nofollow = num(s?.referring_links_attributes?.nofollow);
  return {
    target,
    summary: {
      domainRank: numOrNull(s?.rank),
      backlinks,
      referringDomains: num(s?.referring_domains),
      referringIps: num(s?.referring_ips),
      referringSubnets: num(s?.referring_subnets),
      dofollow: Math.max(0, backlinks - nofollow),
      nofollow,
      brokenBacklinks: num(s?.broken_backlinks),
      spamScore: numOrNull(s?.backlinks_spam_score),
    },
    history: history
      .map((h) => ({
        date: (dfsDate(h.date) ?? "").slice(0, 7) + "-01",
        backlinks: num(h.backlinks),
        referringDomains: num(h.referring_domains),
        newReferringDomains: num(h.new_referring_domains),
        lostReferringDomains: num(h.lost_referring_domains),
      }))
      .filter((h) => h.date.length === 10)
      .sort((a, b) => a.date.localeCompare(b.date)),
    linkTypes: Object.entries(s?.referring_links_types ?? {})
      .map(([type, count]) => ({ type: LINK_TYPE_LABEL[type] ?? type, count: num(count) }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count),
    tlds: Object.entries(s?.referring_links_tld ?? {})
      .map(([tld, n]) => ({ tld: tld.startsWith(".") ? tld : `.${tld}`, referringDomains: num(n) }))
      .sort((a, b) => b.referringDomains - a.referringDomains)
      .slice(0, 8),
  };
}

/**
 * domain_intersection item → gap row. `targetIndex` maps target key ("1".."n") to the column in
 * `domains`; domains not among the targets (excluded) get 0.
 */
export function normalizeGapItem(item: DfsBlIntersectionItem, domains: string[], targetIndex: Record<string, number>) {
  const inter = (item.domain_intersection ?? item) as Record<string, DfsBlIntersectionEntry | null>;
  const analysed = new Set(domains.map((d) => d.toLowerCase()));
  const backlinks: (number | null)[] = domains.map(() => 0);
  let referring: string | null = null;
  let rank: number | null = null;
  for (const [key, e] of Object.entries(inter)) {
    if (!(key in targetIndex) || !e) continue;
    backlinks[targetIndex[key]] = num(e.backlinks);
    // The entry's own name field is the referring domain; ignore it if it's one of the analysed targets.
    const name = e.domain ?? (e.target && !analysed.has(e.target.toLowerCase()) ? e.target : null);
    referring ??= name;
    rank ??= numOrNull(e.rank);
  }
  return referring ? { domain: referring, domainRank: rank, backlinks } : null;
}
