# Phase 2 — DataForSEO integration plan

Integrate **one tool at a time**, in this order. A tool goes live only after every item on its checklist passes.

| # | Tool | Status |
|---|---|---|
| 1 | Domain Overview | **Verified** — full app run on the real API (Nov 2026) |
| 2 | Organic Research | **Verified** — request shapes (nested filters, `has`, `ilike`, etv sort) accepted by the real API; shares Domain Overview's calls |
| 3 | Keyword Overview (+ Keyword Difficulty) | **Verified** — full app run on the real API; two bugs fixed (see below) |
| 4 | Keyword Magic Tool | **Verified** — every mode's request shape accepted by the real API |
| 5 | Organic Competitors | **Verified** — `order_by: intersections` accepted; target appears as its own first row (filtered) |
| 6 | Keyword Gap | **Verified** — `domain_intersection` fields (`first_/second_domain_serp_element`) confirmed |
| 7 | Position Tracking | **Verified** — `task_post` tag echo, `40602 Task in queue` → result flow, domain matching on real SERP |
| 8 | Backlink Analytics | **Verified** — backlinks filters (dofollow, item_type, nested OR `like`) and fields confirmed |
| 9 | Backlink Gap | **Verified** — `targets` / `exclude_targets` / `1.rank` sort+filter accepted; referring domain is in `target` |
| 10 | Backlink Audit | **Verified** (docs + sandbox) — `bulk_spam_score` shape confirmed |
| 11 | Site Audit | **Verified** — real 10-page crawl: task_post → summary → pages (`order_by onpage_score`) |
| 12 | Historical Domain Trends | **Verified** — real pricing measured; default changed to 12 months |
| 13 | SERP Analysis | **Verified** — real SERP; Google redirect-link results handled; `bulk_ranks` honours `rank_scale` |

## Real-API verification (Nov 2026)

Done in three passes:
1. The official docs, checked endpoint by endpoint (free).
2. The DataForSEO **sandbox** for every report (free, real response format).
3. **Real requests:** one per uncertain request shape (`limit: 1`), plus full app runs of Domain Overview and Keyword Overview.

Total spend ≈ $0.50.

**Bugs found and fixed**

| Bug | Fix |
|---|---|
| Error mapping treated every 401xx code as "not authorized" | Only 40100/40104/40201/40207 are account problems. 40101/40103/40107 are temporary provider errors, 40106 is partial success, 40203 is the provider-side cost limit. Full table in `errors.ts` and `tests/errors.test.ts`. |
| Live SERP results can be Google redirect links (`google.com/goto?url=…`, domain `google.com`) | The real host is recovered from `breadcrumb` (`resolveSerpTarget`). Used by SERP tables and rank-check matching. |
| Question filter `^(how|…|do) ` matched "download…" | DataForSEO trims the trailing space, so it now uses a word boundary `\b`. |
| `historical_rank_overview` is billed per month returned: 24 months cost **$0.149** (10× the estimate) | Default history window is now 12 months (Domain Overview, Organic Research, Historical Trends 1y, all sharing one cache entry). 2y/5y show their price. |
| Response cache key didn't include the API base URL, so sandbox data could be served as production | Base URL is now part of the key. |
| Ranked keywords' `last_updated_time` wasn't converted to ISO | Fixed. |
| Domain Overview top anchors could be `null` | Fixed; shown as "(empty)". |
| `irrelevant_meta_keywords` and similar OnPage checks were unmapped | Now mapped as notices. |

**Measured prices** (all estimates in the code updated to these)

| API | Price |
|---|---|
| Labs | $0.012 per task + $0.00012 per returned row |
| Labs `historical_rank_overview` | ≈ $0.012 + $0.0057 per month returned |
| Backlinks | $0.024 per task + $0.000036 per row (history is flat ≈ $0.024) |
| SERP | $0.0006 (standard queue) / $0.002 (live) per 10 results |
| OnPage | $0.00015 per crawled page; summary and pages are free |

**Confirmed from the docs:**
- Labs filters allow up to 8 conditions.
- `regex` is RE2.
- `has` works on arrays.
- `in` takes an array.
- Nested `[cond, "or", cond]` groups work.
- `order_by` accepts at most 3 rules.
- `exact_match` means phrase match.
- Backlinks history starts 2019-01-01; Labs history starts 2020-10-01.
- `exclude_targets` accepts up to 10 domains.

**Not verified on the real API** (low risk, but untested):
- LIKE-wildcard escaping in user text (`\%`, `\_`).
- A full app run of every remaining tool. Their request shapes were verified individually, and their response shapes were checked on the sandbox and in the docs.

**Running behind an HTTPS proxy:** Node's `fetch` ignores `HTTPS_PROXY`. Start the app with `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21) and, if the proxy uses a private CA, `NODE_EXTRA_CA_CERTS=<bundle>`.

## How to add a tool's live integration

1. Add or confirm the endpoint entries in `src/lib/dataforseo/endpoints.ts` (path, TTL, cost estimate).
2. Add raw response types to `src/lib/dataforseo/types.ts`.
3. Write a pure normalizer in `src/lib/dataforseo/normalize/<tool>.ts` that maps the raw response to the type in `src/lib/reports/types.ts`.
4. Write a service in `src/lib/dataforseo/services/<tool>.ts` that runs the calls through `dfsCall` and handles partial failures.
5. Register `live:` for the tool in `src/lib/server/reports.ts`.
6. Set `integration: "ready"` in `src/lib/config/tools.ts`.
7. Test against `scripts/fake-dataforseo.mjs` (add canned responses), then the DataForSEO sandbox, then **one** real request.
8. Compare the normalized values with the raw provider JSON, check the cost in Settings → Usage, then add the tool to `DATAFORSEO_LIVE_TOOLS`.

---

## Integration #1 — Domain Overview

### Files

| File | Role |
|---|---|
| `src/lib/dataforseo/client.ts` | `dfsCall` pipeline (gate → creds → dedupe → cache → budget → rate limit → fetch → log) |
| `src/lib/dataforseo/endpoints.ts` | endpoint registry, TTLs, cost estimates |
| `src/lib/dataforseo/types.ts` | raw response types |
| `src/lib/dataforseo/normalize/common.ts` | position buckets, intent, month keys |
| `src/lib/dataforseo/normalize/domain-overview.ts` | raw → `DomainOverview` |
| `src/lib/dataforseo/services/domain-overview.ts` | the 7 parallel calls, partial-failure notes, snapshot storage |
| `src/lib/server/reports.ts` | wires `live` for `domain-overview` |
| `src/app/api/reports/[tool]/route.ts` | HTTP entry point |
| `src/app/(app)/seo/domain-overview/page.tsx` | UI (unchanged between mock and live) |
| `scripts/fake-dataforseo.mjs` | canned responses for cost-free testing |

### Endpoints and requests

All requests are `POST` with a JSON array containing one task. Common fields: `target`, `location_code`, `language_code`.

| # | Endpoint | Payload (besides target/location/language) | Used for | Required |
|---|---|---|---|---|
| 1 | `/v3/dataforseo_labs/google/domain_rank_overview/live` | `limit: 1` | KPI row: organic/paid `count`, `etv`, `estimated_paid_traffic_cost`; position buckets `pos_1` … `pos_91_100`; `is_new/up/down/lost` | **yes** |
| 2 | `/v3/dataforseo_labs/google/historical_rank_overview/live` | `date_from: YYYY-MM-DD` (12 months back) | trend charts, previous-month deltas, "Data for" month picker | no |
| 3 | `/v3/dataforseo_labs/google/ranked_keywords/live` | `limit: 100`, `item_types: ["organic"]`, `order_by: ["ranked_serp_element.serp_item.etv,desc"]` | top keywords table (10 shown), intent donut (sample of 100), total count | no |
| 4 | `/v3/dataforseo_labs/google/competitors_domain/live` | `limit: 11` (target is filtered out) | competitors table and positioning map | no |
| 5 | `/v3/dataforseo_labs/google/relevant_pages/live` | `limit: 6`, `order_by: ["metrics.organic.etv,desc"]` | top pages | no |
| 6 | `/v3/backlinks/summary/live` | `include_subdomains: true`, `rank_scale: "one_hundred"` (no location) | Domain Rank, backlinks, referring domains/IPs, nofollow, TLDs | no |
| 7 | `/v3/backlinks/anchors/live` | `limit: 6`, `order_by: ["backlinks,desc"]` | top anchors | no |

**VERIFY before going live:**

- `rank_scale` is accepted by `backlinks/summary`. If not, remove it and divide `rank` (0–1000) by 10 in the normalizer.
- The `order_by` field paths for `ranked_keywords` and `relevant_pages`.
- `competitors_domain` item fields: `intersections`, `full_domain_metrics.organic.{count,etv}`, `avg_position`.
- `historical_rank_overview` returns `items[]` with `year`, `month` and `metrics.{organic,paid}`. Check whether the latest item is the current month or the previous one. The normalizer computes the delta against the calendar month before the latest point, so either case works.
- `ranked_keywords` includes `keyword_data.search_intent_info.main_intent` and `keyword_properties.keyword_difficulty`.
- Error codes in `src/lib/dataforseo/errors.ts` match https://docs.dataforseo.com/v3/appendix/errors/.
- Market codes in `src/lib/config/markets.ts` match the free endpoint `GET /v3/dataforseo_labs/locations_and_languages`.

### Not requested in v1

`countries` (traffic by country) is `null` in live mode, and the card hides itself. To add it later, check whether `domain_rank_overview` without `location_code` returns per-location items, or use `/v3/dataforseo_labs/google/bulk_traffic_estimation/live`.

### Cost per uncached lookup (measured on the real API, Nov 2026)

| Call | Cost |
|---|---|
| domain_rank_overview | $0.0121 |
| historical_rank_overview (12 months) | ≈ $0.080 (billed per month) |
| ranked_keywords (100) | $0.024 |
| competitors_domain (11) | $0.0133 |
| relevant_pages (6) | $0.0127 |
| backlinks/summary | $0.024 |
| backlinks/anchors (6) | $0.0242 |
| **Total** | **≈ $0.19 per domain + market** (it was $0.26 with 24 months of history) |

Repeat lookups are free until the cache entries expire: 7 days for Labs overview, history, competitors and pages; 3 days for ranked keywords; 1 day for backlinks. The defaults are $0.50 per request, $5 per day and $50 per month, adjustable in Settings.

### Metric definitions shown in the UI

- **Organic traffic (est.)** = DataForSEO `etv`: modelled from rankings × search volume × CTR. It is not Google Analytics or Search Console data.
- **Organic traffic value** = `estimated_paid_traffic_cost`: what that traffic would cost in Google Ads.
- **Domain Rank** = DataForSEO backlink `rank` (0–100 scale). It is a provider metric, not a Google signal.
- **Competition level** = common keywords ÷ (target keywords + competitor keywords − common).
- **Intent breakdown** is computed from the top-100 keyword sample, and the UI says so.

### Go-live checklist (Domain Overview)

- [ ] Credentials saved, and **Test connection** succeeds (free `appendix/user_data`).
- [ ] `DATAFORSEO_USE_SANDBOX=true`: the page renders from sandbox responses, and the normalizer handles them.
- [ ] Every VERIFY item above checked against the docs.
- [ ] One real lookup on a known domain; compare the KPI values with the raw JSON (Settings → Usage shows the endpoints and cost).
- [ ] The second lookup shows `CACHED · DataForSEO` and costs $0.
- [ ] Error states checked: wrong password (`NOT_CONFIGURED`), an invalid domain (`VALIDATION_ERROR`), the budget at $0 (`BUDGET_EXCEEDED`).
- [ ] A row is written to `DomainSnapshot`.

Then set:

```bash
DATAFORSEO_LIVE_ENABLED=true
DATAFORSEO_LIVE_TOOLS=domain-overview
```

---

## Integration #2 — Organic Research

### Files

| File | Role |
|---|---|
| `src/lib/reports/ranked-query.ts` | Shared query spec (page, size, sort, filters). The zod schema validates URL params; `applyRankedQuery` is the mock implementation. |
| `src/lib/dataforseo/filters.ts` | `rankedQueryToDfs`: query → DataForSEO `filters` / `order_by` / `limit` / `offset` (max 8 conditions) |
| `src/lib/dataforseo/services/labs-common.ts` | Shared payload builders for `domain_rank_overview` / `historical_rank_overview`, so the cache is shared with Domain Overview |
| `src/lib/dataforseo/services/organic-research.ts` | `summary`, `keywords` and `pages` views |
| `src/lib/client/ranked-table.ts` | Table state → query params |
| `src/components/data/data-table.tsx` | New `remote` mode: sorting, filters, debounced search and paging are delegated to the server |
| `src/app/(app)/seo/organic-research/page.tsx` | UI |
| `tests/*.test.ts` | Unit tests for the translator, schema, mock query and normalizers (`npm test`) |

### Requests

`GET /api/reports/organic-research?q=…&view=summary|keywords|pages&page=&size=&sort=&dir=&inc=&exc=&posMin=&posMax=&volMin=&volMax=&kdMin=&kdMax=&cpcMin=&cpcMax=&intent=&serp=`

| View | Endpoint | Payload |
|---|---|---|
| summary | `domain_rank_overview` + `historical_rank_overview` | Identical to Domain Overview, so it is usually a **cache hit** |
| keywords | `ranked_keywords/live` | `item_types: ["organic"]`, `limit` (25 / 50 / 100), `offset`, `order_by` (+ secondary `search_volume,desc` for stable paging), `filters` |
| pages | `relevant_pages/live` | `limit`, `offset`, `order_by: ["metrics.organic.etv,desc"]` |

Keywords and pages also call `domain_rank_overview` to get the domain's ETV for "Traffic %". That call is normally cached.

Filter mapping:

| UI filter | DataForSEO condition |
|---|---|
| Keyword search / Include | `keyword_data.keyword ilike %word%` (LIKE wildcards escaped) |
| Exclude | `keyword_data.keyword not_ilike %word%` |
| Positions | `ranked_serp_element.serp_item.rank_group` `>=` / `<=` |
| Volume / KD / CPC | `keyword_data.keyword_info.search_volume`, `keyword_data.keyword_properties.keyword_difficulty`, `keyword_data.keyword_info.cpc` |
| Intent | `keyword_data.search_intent_info.main_intent in [...]` |
| SERP features | `ranked_serp_element.serp_item_types has X`, OR-grouped when several are selected |

Sortable columns: Traffic (and Traffic %, which sorts by traffic), Position, Volume, KD, CPC. Other columns are not sortable in this view, because the API can't order by them.

Limits:
- At most 8 filter conditions per request; the API returns `VALIDATION_ERROR` before any request if exceeded.
- Paging stops at row 20,000.
- Export covers the current page.

**VERIFY:**
- `has` works on `serp_item_types`.
- Nested OR groups are accepted inside `filters`.
- `ilike` / `not_ilike` on `keyword_data.keyword`.
- `total_count` reflects the filtered total.
- `relevant_pages` returns `total_count`.

### Cost

| Action | Estimate |
|---|---|
| Each keywords page (uncached) | ≈ $0.01 + $0.0001 × rows → 50 rows ≈ $0.015 |
| Each pages page | ≈ $0.0125 |

Results are cached for 3 days (keywords) and 7 days (pages), keyed by the full query. Revisiting a page, sort or filter combination within that window is free. Changing the search text is debounced (400 ms), so typing doesn't fire a request per keystroke.

### Go-live checklist (Organic Research)

- [ ] Domain Overview is live and verified (shares the summary calls).
- [ ] Sandbox: every filter and every sortable column returns rows without a provider error.
- [ ] One real domain: compare page 1 against the raw `ranked_keywords` JSON; check `total_count` with and without a filter.
- [ ] Page 2 / page 3 rows don't overlap page 1 (stable ordering).
- [ ] Add `organic-research` to `DATAFORSEO_LIVE_TOOLS`.

---

## Integration #3 — Keyword Overview + Keyword Difficulty

### Files

| File | Role |
|---|---|
| `src/lib/dataforseo/normalize/keywords.ts` | Keyword item → `KeywordMetrics`; SERP → `SerpResult[]` |
| `src/lib/dataforseo/services/keywords.ts` | `fetchKeywordOverview`, `fetchKeywordDifficulty` |
| `src/components/report/serp-columns.tsx` | `serpColumnsFor` hides SERP metric columns that have no data |
| `tests/keywords.test.ts` | Normalizer tests |

### Keyword Overview — 4 parallel requests

Only #1 is required.

| # | Endpoint | Payload | Used for |
|---|---|---|---|
| 1 | `dataforseo_labs/google/keyword_overview/live` | `keywords: [kw]`, `include_serp_info: true` | Volume, 12-month trend, KD, CPC, competition, intent, SERP features, results count |
| 2 | `dataforseo_labs/google/keyword_suggestions/live` | `keyword`, `limit: 10`, `order_by: ["keyword_info.search_volume,desc"]` | Keyword variations (phrase-match) |
| 3 | `dataforseo_labs/google/keyword_suggestions/live` | Same as #2, plus `filters: [["keyword","regex","^(how|what|why|…) "]]` | Questions |
| 4 | `serp/google/organic/live/advanced` | `keyword`, `device: "desktop"`, `depth: 10` | SERP table |

**Cost:** ≈ $0.035 per uncached keyword. Cached 14 days for the Labs calls and 12 h for the SERP.

The live SERP doesn't include Domain Rank, backlinks or traffic per result. Those columns hide automatically, and a note explains why. Adding them later would mean one `backlinks/bulk_ranks` call per SERP (≈ $0.02).

### Keyword Difficulty

One `keyword_overview/live` call for the whole list (≤ 100 keywords): ≈ $0.01 + $0.0001 per keyword. Keywords the provider has no data for are listed in a note; they never get placeholder values.

### VERIFY

- `regex` operator on `keyword` in `keyword_suggestions` filters. Fallback: OR-group of `ilike "how %"` etc.
- `keyword_overview` item shape: `keyword_info.monthly_searches`, `keyword_properties.keyword_difficulty`, `serp_info.serp_item_types`, `serp_info.se_results_count`, `search_intent_info.main_intent`.
- Max keywords per `keyword_overview` task (docs: 700).
- SERP `items[].rank_absolute`, `domain`, `title`, `url`, `description`.

### Go-live checklist

- [ ] Sandbox: page renders; variations and questions return rows.
- [ ] One real keyword: compare volume / KD / CPC and the monthly trend with the raw JSON.
- [ ] Add `keyword-overview,keyword-difficulty` to `DATAFORSEO_LIVE_TOOLS`.

---

## Integration #4 — Keyword Magic Tool

### Files

| File | Role |
|---|---|
| `src/lib/reports/keyword-query.ts` | Query spec (mode, page, size, sort, filters), mock `applyKeywordQuery`, `wordGroups`, question regex |
| `src/lib/dataforseo/filters.ts` | `keywordQueryToDfs(q, prefix)`; prefix is `keyword_data.` for related_keywords |
| `src/lib/dataforseo/services/keyword-magic.ts` | Picks the endpoint per mode; one request per table page |
| `src/lib/client/ranked-table.ts` | `keywordParamsFromTable` (table state → params) |
| `src/app/(app)/seo/keyword-magic-tool/page.tsx` | Modes, groups sidebar, remote table |
| `tests/keyword-magic.test.ts` | Translator, schema, mock query, groups |

### Modes

| Mode | Endpoint | Key payload |
|---|---|---|
| Broad match | `keyword_suggestions/live` | `keyword`, `exact_match: false` |
| Phrase match | `keyword_suggestions/live` | `keyword`, `exact_match: true` |
| Questions | `keyword_suggestions/live` | Plus `["keyword","regex","^(how|what|…) "]` |
| Related | `related_keywords/live` | `keyword`, `depth: 2`; fields under `keyword_data.` |
| Ideas | `keyword_ideas/live` | `keywords: [seed]` |

All modes send `include_serp_info: true`, `limit` (25 / 50 / 100), `offset`, `order_by` (volume, KD, CPC or competition, with a secondary volume sort) and `filters` (include/exclude words, volume, KD, CPC, intent; max 8 conditions). Paging stops at row 10,000.

The previous mock-only "Exact match" mode was dropped: DataForSEO has no equivalent, and it wasn't going to be faked.

### Groups sidebar

The groups are the common words among the keywords on the **current page**, and the UI says so. Clicking one applies a server-side "contains" filter to all results. A true grouping over every result would need a large extra request (≈ $0.11 for 1,000 rows), so it isn't done automatically.

### Cost

≈ $0.01 + $0.0001 × rows per page, so 50 rows ≈ $0.015. Cached for 14 days per mode + filters + page.

### VERIFY

- `exact_match` semantics on `keyword_suggestions`.
- `related_keywords` accepts `offset` + `order_by` + `filters` with the `keyword_data.` prefix, and `total_count` with `depth: 2`.
- `keyword_ideas` accepts `order_by` / `filters` on these fields.
- `regex` operator support (shared with Keyword Overview questions).

### Go-live checklist

- [ ] Sandbox: each mode returns rows; each sortable column and filter works.
- [ ] One real seed: page 1 vs page 2 don't overlap; `total_count` changes with filters.
- [ ] Add `keyword-magic-tool` to `DATAFORSEO_LIVE_TOOLS`.

---

## Integration #5 — Organic Competitors

| Endpoint | Payload | Notes |
|---|---|---|
| `dataforseo_labs/google/competitors_domain/live` | `limit: 100`, `order_by: ["intersections,desc"]` | ≈ $0.02. The target is filtered out of its own list. |
| `dataforseo_labs/google/domain_rank_overview/live` | Same payload as Domain Overview | Target totals; usually cached |

Generic sites (Wikipedia, YouTube, Reddit, …) rank for almost everything, so they're **hidden by default**. Use "Show generic sites" to include them. The filter runs locally (`src/lib/reports/generic-domains.ts`) and doesn't depend on any provider option. Domain Overview's competitor widgets apply the same filter.

**VERIFY:**
- `order_by` field `intersections`.
- Item fields `intersections`, `avg_position`, `full_domain_metrics.organic.{count,etv}`.

---

## Integration #6 — Keyword Gap

`domain_intersection` compares exactly two domains. For you vs each competitor there are three requests, each capped at the chosen **sample** (top 200 / 500 / 1,000 by search volume):

| Request | Payload | Gives |
|---|---|---|
| Shared | `target1: you, target2: comp, intersections: true` | Your position and theirs |
| Competitor only | `target1: comp, target2: you, intersections: false` | Their position; you don't rank |
| You only | `target1: you, target2: comp, intersections: false` | Your position; they don't rank |

All requests also send `item_types: ["organic"]` and `order_by: ["keyword_data.keyword_info.search_volume,desc"]`. Plus one `domain_rank_overview` per domain for total keyword counts (usually cached).

`mergeGap` (`src/lib/reports/keyword-gap.ts`) builds one row per keyword with a position per domain. Tabs follow the usual definitions:

| Tab | Rule |
|---|---|
| Shared | Every domain ranks |
| Missing | Every competitor ranks, you don't |
| Weak | Everyone ranks, and you rank below every competitor |
| Strong | Everyone ranks, and you rank above every competitor |
| Untapped | At least one competitor ranks, you don't |
| Unique | Only you rank |

**Sampling caveat (shown in the UI):** "not ranking" means "not in the analysed sample". With 3+ domains, a keyword counts as shared by all only if it appears in every pairwise list, so larger samples give fuller overlaps.

**Cost:** `estimateGapCost` = 3 × competitors × ($0.01 + $0.0001 × sample) + $0.0101 × domains. Examples:

| Comparison | Estimate |
|---|---|
| 2 domains @ 200 | ≈ $0.11 |
| 2 domains @ 500 | ≈ $0.20 |
| 5 domains @ 1,000 | ≈ $1.37 |

The form shows this estimate before you compare. Each request is also checked against the per-request limit, and results are cached for 3 days.

**VERIFY:**
- Item fields `keyword_data`, `first_domain_serp_element.rank_group`, `second_domain_serp_element.rank_group`.
- `intersections: false` semantics: keywords target1 ranks for and target2 doesn't.

### Go-live checklist (#5 and #6)

- [ ] Sandbox: competitors list returns, and the target is excluded.
- [ ] One real 2-domain gap at sample 200: spot-check 5 keywords per tab against Google or the raw JSON.
- [ ] Add `organic-competitors,keyword-gap` to `DATAFORSEO_LIVE_TOOLS`.

---

## Integrations #8–10 — Backlinks

Files:

| File | Role |
|---|---|
| `src/lib/reports/backlink-query.ts` | Query specs and mock filters |
| `src/lib/dataforseo/filters.ts` | `blQueryToDfs`, `blGapToDfs` |
| `src/lib/dataforseo/normalize/backlinks.ts` | Normalizers |
| `src/lib/dataforseo/services/backlinks.ts` | Services |
| `src/lib/reports/backlink-risk.ts` | Audit risk rules |
| `tests/backlinks.test.ts` | Tests |

Every request sends `rank_scale: "one_hundred"`, so Domain Rank is 0–100 everywhere. `include_subdomains: true` is used where applicable.

### #8 Backlink Analytics

| View | Endpoint | Payload / notes |
|---|---|---|
| summary | `backlinks/summary/live` + `backlinks/history/live` | Summary payload shared with Domain Overview (same cache entry); history `date_from` = 24 months back |
| backlinks | `backlinks/backlinks/live` | `mode: "as_is"`, `backlinks_status_type: live/lost`, filters `is_new`, `dofollow`, `item_type in`, `domain_from_rank`, url/anchor `like`; sort `domain_from_rank` / `first_seen` / `last_seen` |
| domains | `backlinks/referring_domains/live` | Filters `rank`, `backlinks_spam_score <=`, `domain like`; sort `rank` / `backlinks` / `first_seen` |
| anchors | `backlinks/anchors/live` | Filter `anchor like`; sort `backlinks` / `referring_domains` |

**Cost:** each table page ≈ $0.02 + $0.00003 × rows (≈ $0.0215 for 50). The summary is ≈ $0.04 for two requests. Cached for 1 day (summary, tables) and 7 days (history).

### #9 Backlink Gap

`backlinks/domain_intersection/live` takes up to 20 `targets` plus `exclude_targets`, so every tab is a single request:

| Tab | targets | exclude_targets | intersection_mode |
|---|---|---|---|
| Best | Competitors | You | `all` |
| Untapped | Competitors | You | `partial` |
| Shared | Everyone | — | `all` |
| Unique | You | Competitors | `all` |

Tabs load on demand, one request per tab page (≈ $0.02). Rows are ordered by `1.rank` desc, with an optional `1.rank >=` filter. Excluded domains get 0 links.

The previous mock-only "Weak" tab was renamed **Untapped**, because what it computes is "at least one competitor, not you".

### #10 Backlink Audit

1. `backlinks/referring_domains/live`: top 500 or 1,000 referring domains by backlink count.
2. `backlinks/bulk_spam_score/live`: each domain's own spam score. If this fails, the audit falls back to the link-level `backlinks_spam_score` and says so in a note.

`assessRisk()` then applies these rules:

| Signal | Effect |
|---|---|
| Spam score ≥ 60 | Toxic |
| Spam score 30–59 | Suspicious |
| Low-quality TLD | Risk signal |
| Domain Rank < 5 | Risk signal |
| Sitewide dofollow links (>1,000 links, >95% follow) from a domain with rank < 30 | Risk signal |

Two or more risk signals make a domain toxic; one makes it suspicious.

**Cost:** ≈ $0.07 for 500 domains, ≈ $0.10 for 1,000; shown beside the sample picker. The "Disavow file" export lists only toxic domains, with a header telling you to review it first.

### VERIFY (backlinks)

- Backlinks item fields: `item_type`, `domain_from_rank`, `dofollow`, `is_new`, `is_lost`, `page_from_title`.
- `backlinks_status_type` values.
- `history` item `date` format, and `new_` / `lost_referring_domains`.
- domain_intersection item structure (`domain_intersection` keyed "1".."n"; which field holds the referring domain), and `order_by` / `filters` with the `"1.rank"` syntax.
- `bulk_spam_score` result shape (`items[].target`, `spam_score`).

### Go-live checklist (#8–10)

- [ ] Sandbox: each tab and filter returns rows; history renders.
- [ ] One real domain: compare summary numbers with the raw JSON; page 2 doesn't overlap page 1.
- [ ] Gap: spot-check 5 "Best" domains, confirming they link to every competitor and not to you.
- [ ] Add `backlink-analytics,backlink-gap,backlink-audit` to `DATAFORSEO_LIVE_TOOLS`.

---

## Integration #12 — Historical Domain Trends

| Source | Payload | Notes |
|---|---|---|
| `dataforseo_labs/google/historical_rank_overview/live` | `historyPayload(target, months)` | Same builder as Domain Overview and Organic Research |
| `backlinks/history/live` | `backlinksHistoryPayload(target, months)` | Same builder as Backlink Analytics |
| `DomainSnapshot` table | — | Rows written by every live Domain Overview lookup (free) |

**Spans:**

| Span | Months | Cost |
|---|---|---|
| 2 years (default) | 24 | Identical payloads to the other tools, so usually **$0** (cached) |
| 5 years | 60 | Two new requests, ≈ $0.04 |

**Gaps:** `fillMonthGaps` (`src/lib/reports/history.ts`) inserts a `missing: true` row with null metrics for every month the provider didn't return. Charts show a break, with point markers whenever a series has gaps; the table shows "no data"; a note counts the missing months. Cards compare the first and last months *that have data*. Nothing is interpolated.

**VERIFY:** how far back `historical_rank_overview` and `backlinks/history` return data (60-month requests may come back shorter, which is fine — the series simply starts later).

---

## Integration #13 — SERP Analysis

| Request | Payload | Cost |
|---|---|---|
| `serp/google/organic/live/advanced` | `keyword`, location, language, `device` (desktop/mobile), `depth` (10/20/50/100) | ≈ $0.002 per 10 results |
| Optional `backlinks/bulk_ranks/live` | `targets` = unique result domains, `rank_scale: "one_hundred"` | ≈ $0.02 |

The optional request fills the Domain Rank column and the "Avg. Domain Rank" card. It's off by default and controlled by the "Domain Rank" switch.

The cost estimate (`estimateSerpCost` in `src/lib/reports/serp.ts`) is shown next to the controls.

**Caching:** SERPs are cached for 12 hours, and the page notes how long ago Google was checked. **Re-check now** makes one request with `fresh=1`, which bypasses the cache but stores the new result, then reloads the normal view from that cache. Reloading the page afterwards costs nothing.

**VERIFY:**
- SERP pricing per depth.
- `bulk_ranks` result shape (`items[].target`, `rank`).
- SERP `datetime` field format.

### Go-live checklist (#12, #13)

- [ ] One real domain: the 2-year trends view costs $0 after Domain Overview + Backlink Analytics; months match the raw JSON.
- [ ] One real keyword: desktop vs mobile differ as expected; Domain Rank values look right; re-check shows a new "checked" time.
- [ ] Add `historical-trends,serp-analysis` to `DATAFORSEO_LIVE_TOOLS`.

---

## Integration #7 — Position Tracking

**Data model.** `TrackingProject` (domain, market, device, `depth`), `TrackedKeyword` (tags, search volume) and `RankSnapshot` (one row per check). Each check has a status (`pending`, `done` or `failed`) and a source (`live` or `mock`). Up to 500 keywords per project.

**Flow:**

| Step | What happens |
|---|---|
| Check | `runChecks(project)` covers keywords with no pending/done check today (UTC). **Live:** `serp/google/organic/task_post` in batches of ≤ 100 tasks per request (`dfsBatch`), `tag` = keyword id, stored as *pending* with the task id and cost. **Mock:** labelled mock positions are written immediately. |
| Collect | `collectResults()` calls `serp/google/organic/task_get/advanced/{id}` (free) for pending checks older than 30 s. The first organic result whose domain is the tracked domain or a subdomain gives the position (`rank_group`) and URL. "Not in depth" = `null`. "Task in queue" (40601/40602) stays pending. Pending for > 24 h → failed. |
| When | On every project-page load (the page polls every 15 s while checks are pending), and by the daily cron. |
| Report | `buildTrackingReport` uses the latest completed check per keyword per day. Days without checks are **gaps**; nothing is back-filled. |

Visibility = Σ CTR(position) ÷ (keywords × 30%).

**Search volume:** one `keyword_overview` request when keywords are added (live only).

**Cost:** ≈ $0.0006 per 10 results per keyword per day (standard queue). The project dialog shows the per-day and per-month estimate; actual cost is logged per task.

**Cron (`/api/cron/daily`, `vercel.json`):**
- 06:17 UTC: post today's checks for every project, then collect.
- 06:47 UTC (`?phase=collect`): collect again.

The cron also finalizes unfinished site audits. Set `CRON_SECRET` in Vercel; Vercel then sends it as a Bearer token. Locally, call `curl localhost:3000/api/cron/daily` (allowed only when not in production).

**VERIFY:**
- Standard-queue SERP pricing per depth.
- `task_post` response `tasks[].data.tag` echo.
- Pending status codes 40601 / 40602.
- `task_get/advanced` item fields `rank_group`, `domain`, `url`.

---

## Integration #11 — Site Audit

| Step | Endpoint / action |
|---|---|
| Start | `on_page/task_post` `{ target, max_crawl_pages, load_resources: false, enable_javascript: false, store_raw_html: false }`. Page limits 100 – 2,000; ≈ $0.000125 per page (basic crawl), shown before starting. One running crawl per domain. |
| Poll | `on_page/summary/{task_id}` (free). The page polls every 8 s while crawling and shows pages crawled / queued. |
| Finish | When `crawl_progress = "finished"`: `on_page/pages` (`limit: 1000`, ordered by `onpage_score`) is fetched (free) and `normalizeOnPage` builds the report. The report is **stored in `SiteAuditCrawl.summary`**, so it stays available after DataForSEO deletes the task. |
| History | Every crawl is listed per domain and selectable. |
| Daily cron | Finalizes crawls nobody has viewed. |

**Issue mapping:** only checks that indicate a problem are mapped (`ONPAGE_ISSUES` in `src/lib/dataforseo/normalize/on-page.ts`), with title, severity and category. Positive checks (`is_https`, `has_micromarkup`, …) and unknown checks are ignored.

**Status codes:** from `is_4xx_code`, `is_5xx_code` and `is_redirect`; 2xx = crawled − those.

The mock-only "thematic scores" panel was replaced by **issues by category**, because DataForSEO doesn't provide thematic scores.

**Mock mode:** starting a crawl creates an instantly finished, labelled mock crawl.

**VERIFY:**
- `on_page/summary` shape: `crawl_progress`, `crawl_status`, `page_metrics.checks` names.
- `on_page/pages` `order_by` field.
- Per-page pricing.

### Go-live checklist (#7, #11)

- [ ] Sandbox: a project's first check goes pending → done; a crawl goes crawling → finished.
- [ ] One real project with ~10 keywords: compare positions with a manual Google check (same location/device).
- [ ] Deploy with `CRON_SECRET` set; confirm the cron runs (Vercel → Project → Cron Jobs).
- [ ] Add `position-tracking,site-audit` to `DATAFORSEO_LIVE_TOOLS`.

---

## Usage meter

The header shows today's DataForSEO spend, with a bar against the daily limit. It turns amber at 80% of a limit and red at 100%, with an icon and label as well as colour. Click it to see:
- today and this month against your limits
- paid requests and cache hits
- money saved by the cache
- your account balance, refreshed with the free `appendix/user_data` endpoint
- the latest requests

Data comes from `GET /api/usage/meter`, which sums `ApiRequestLog.costUsd`: the cost DataForSEO reports on each response. Cache hits are logged with the original request's cost in `estimatedUsd`, which is where "saved by cache" comes from.

The meter refreshes every 20 s and immediately after any report that touched the provider. A short "+$x" chip shows each increase. "Today" is a UTC day.

---

## Later tools — endpoint map

| Tool | Endpoints | Notes |
|---|---|---|
| Keyword Magic Tool | `labs/google/keyword_suggestions/live` (phrase), `related_keywords/live` (related), `keyword_ideas/live` (broad) | Map the UI modes to these endpoints; build questions with a `filters` regex or from `keyword_suggestions`. |
