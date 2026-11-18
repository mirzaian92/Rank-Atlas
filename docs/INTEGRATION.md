# Phase 2 — DataForSEO integration plan

Integrate **one tool at a time**, in this order. A tool goes live only after every item on its checklist passes.

| # | Tool | Status |
|---|---|---|
| 1 | Domain Overview | **Ready** — live code written and tested against a local fake server; not yet run against the real API |
| 2 | Organic Research | Mock |
| 3 | Keyword Overview (+ Keyword Difficulty) | Mock |
| 4 | Keyword Magic Tool | Mock |
| 5 | Organic Competitors | Mock |
| 6 | Keyword Gap | Mock |
| 7 | Position Tracking | Mock |
| 8 | Backlink Analytics | Mock |
| 9 | Backlink Gap | Mock |
| 10 | Backlink Audit | Mock |
| 11 | Site Audit | Mock |
| 12 | Historical Domain Trends | Mock |
| 13 | SERP Analysis | Mock |

> ⚠️ `docs.dataforseo.com` was not reachable from the build environment. Endpoint paths and fields below
> were written from DataForSEO v3 knowledge. Items marked **VERIFY** must be checked against the official
> docs (or a sandbox response) before the tool's first paid request.

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
| 2 | `/v3/dataforseo_labs/google/historical_rank_overview/live` | `date_from: YYYY-MM-DD` (24 months back) | trend charts, previous-month deltas, "Data for" month picker | no |
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

### Cost per uncached lookup (pre-flight estimates — VERIFY at dataforseo.com/pricing)

| Call | Estimate |
|---|---|
| domain_rank_overview | ~$0.0101 |
| historical_rank_overview | ~$0.0125 |
| ranked_keywords (100) | ~$0.0200 |
| competitors_domain (11) | ~$0.0111 |
| relevant_pages (6) | ~$0.0106 |
| backlinks/summary | ~$0.0200 |
| backlinks/anchors (6) | ~$0.0202 |
| **Total** | **≈ $0.10 per domain + market** |

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

## Later tools — endpoint map

| Tool | Endpoints | Notes |
|---|---|---|
| Organic Research | `labs/google/ranked_keywords/live`, `labs/google/relevant_pages/live`, `historical_rank_overview` | Server-side pagination via `offset` / `limit`. Translate table filters into DataForSEO `filters` arrays. Use the `DataTable` `server` prop. |
| Keyword Overview / Difficulty | `labs/google/keyword_overview/live`, `labs/google/bulk_keyword_difficulty/live`, `serp/google/organic/live/advanced` | Up to 700 keywords per KD task. **VERIFY** the limit. |
| Keyword Magic Tool | `labs/google/keyword_suggestions/live` (phrase), `related_keywords/live` (related), `keyword_ideas/live` (broad) | Map the UI modes to these endpoints; build questions with a `filters` regex or from `keyword_suggestions`. |
| Organic Competitors | `labs/google/competitors_domain/live` | |
| Keyword Gap | `labs/google/domain_intersection/live` (`target1`, `target2`, `intersections: true/false`) | Pairwise only; for 3–5 domains, combine pairwise results or use `ranked_keywords` per domain. |
| Position Tracking | `serp/google/organic/task_post` → `tasks_ready` → `task_get/advanced/{id}` | Standard queue, which is cheaper. Daily job writes `RankSnapshot`. History comes **only** from stored snapshots. |
| Backlink Analytics | `backlinks/summary`, `backlinks`, `referring_domains`, `anchors`, `history` (or `timeseries_summary`) | |
| Backlink Gap | `backlinks/domain_intersection/live` | |
| Backlink Audit | `backlinks/referring_domains/live`, `backlinks/bulk_spam_score/live` | Risk labels are local heuristics. |
| Site Audit | `on_page/task_post` → `on_page/summary/{id}` → `on_page/pages`, `duplicate_tags`, `links` | Asynchronous: store the task id in `SiteAuditCrawl` and poll. Show a cost estimate before starting (≈ $0.000125 per page). |
| Historical Trends | `labs/google/historical_rank_overview/live`, `backlinks/history/live` + `DomainSnapshot` | Gaps stay gaps; nothing is interpolated. |
| SERP Analysis | `serp/google/organic/live/advanced` (`device`, `depth`) | 12 h cache. |
