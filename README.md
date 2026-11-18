# RankAtlas — SEO research & analytics

A Semrush-style SEO research platform (original branding) built on **DataForSEO API v3**.
Next.js App Router · TypeScript · Tailwind CSS v4 · shadcn/ui-style components (Radix) · Recharts · TanStack Table · TanStack Query · PostgreSQL · Prisma.

> **Status:** All 14 tools have full UI with **labelled mock data**. The DataForSEO layer is built.
> Domain Overview (#1) and Organic Research (#2) have live implementations that are **switched off**
> by default. No paid requests are made unless you enable them.

## Local setup

Requirements: Node 20+ (tested on 22), PostgreSQL 14+ (tested on 16).

```bash
npm install
```

```bash
cp .env.example .env
```

Generate an encryption key and paste it into `APP_ENCRYPTION_KEY` in `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Create the database (adjust user and password to match `DATABASE_URL`):

```bash
psql -U postgres -c "CREATE USER rankatlas WITH PASSWORD 'rankatlas' CREATEDB;" -c "CREATE DATABASE rankatlas OWNER rankatlas;"
```

```bash
npx prisma migrate dev --name init
```

```bash
npm run dev
```

Open http://localhost:3000. The app also runs without PostgreSQL: mock reports still work, but saved
searches, usage logs, the cache, spending limits and DB-stored credentials are disabled.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) for filter translation, query handling and normalizers |
| `npm run db:migrate` / `db:deploy` / `db:studio` | Prisma |
| `node scripts/fake-dataforseo.mjs` | Local fake DataForSEO server (see "Testing without cost") |

## What's in the UI

- Dark, collapsible left navigation: **SEO Research** (Domain Overview, Organic Research, Organic Competitors, Keyword Overview, Keyword Magic Tool, Keyword Difficulty, Keyword Gap, Position Tracking), **Link Building** (Backlink Analytics, Backlink Gap, Backlink Audit), **Website Analysis** (Site Audit, Historical Domain Trends, SERP Analysis), plus Settings. On mobile it opens as a drawer.
- A header with a universal domain/keyword search (detects the input type; it stays on the current tool or routes to Domain or Keyword Overview), a country + language market selector (DataForSEO `location_code` / `language_code`), and a data-mode indicator (Mock / Live / Sandbox).
- All report state lives in the URL (`?q=&db=&lang=&range=&tab=…`), so every view can be shared and bookmarked.
- Reusable building blocks:
  - `ReportView` page shell: loading, error, empty and landing states, plus the data-source badge.
  - `MetricCard`, `Section`, `DateRangeControl` / `MonthPicker`.
  - `DataTable`: search, typed filters (range, multi-select, include/exclude), sorting, column visibility, pagination (client- or server-side), and CSV / JSON / TSV export.
  - Recharts wrappers: trend, stacked area, bars, donut, scatter map, sparklines.
- Every number from mock data carries a **MOCK** label, and the page header says MOCK DATA.
- Traffic is always labelled *estimated* and is never presented as Analytics or Search Console data.

### Previewing UI states (development only)

Append `&__state=` to any report URL:

| Value | What it shows |
|---|---|
| `slow` | 2.5 s delay, to see loading skeletons |
| `error` | Provider error |
| `unavailable` | API unavailable |
| `budget` | Spending limit reached |
| `empty` | Every array blanked |

## Architecture

```
src/
  app/(app)/…                 pages (one folder per tool) + settings + home
  app/api/reports/[tool]      single report endpoint: validate → mock | live → normalized JSON
  app/api/settings/*          credentials (encrypted), limits, cache, connection test
  app/api/usage, saved-searches
  components/ui               shadcn-style primitives
  components/{layout,report,data,charts,states}   app-level reusable components
  lib/config                  tools registry (nav, endpoints, integration status), markets
  lib/reports                 response envelope + normalized report types (UI contract)
  lib/mock                    deterministic mock generators (UI design only)
  lib/dataforseo              server-only provider layer (see below)
  lib/server                  prisma, crypto, settings, report registry
prisma/schema.prisma          credentials, request log, cache, saved searches, snapshots, tracking, audits
```

### DataForSEO layer (`src/lib/dataforseo`, server-only)

Each call to `dfsCall(endpointKey, payload, { tool })` goes through these steps in order:

1. **Live gate:** `DATAFORSEO_LIVE_ENABLED=true`, the tool listed in `DATAFORSEO_LIVE_TOOLS`, and the tool not marked `mock`.
2. **Credentials:** env vars first, otherwise the AES-256-GCM-encrypted row saved from Settings.
3. **In-flight dedupe:** identical concurrent requests share one provider call.
4. **Cache:** a Postgres-backed cache (plus an in-memory layer) keyed by `sha256(path + canonical JSON)`, with a per-endpoint TTL.
5. **Budget:** a pre-flight cost estimate is checked against the per-request, daily and monthly limits.
6. **Rate limit:** a per-API-group token bucket plus a concurrency cap.
7. **Fetch:** Basic auth, 60 s timeout, retry with backoff on network errors and 429/5xx.
8. **Envelope check:** DataForSEO `status_code` values are mapped to typed errors (`NOT_CONFIGURED`, `INSUFFICIENT_FUNDS`, `RATE_LIMITED`, `API_UNAVAILABLE`, …).
9. **Usage log:** each call is logged with the **actual `cost`** from the response; cache hits are logged at $0.
10. **Cache store.**

Raw responses are mapped to UI types by pure functions in `normalize/`. Service modules in `services/` orchestrate several calls into one report and record snapshots.

Credentials never reach the browser: they are used only in route handlers, and the settings API returns a masked login.

### Testing without cost

```bash
node scripts/fake-dataforseo.mjs
```

```bash
DATAFORSEO_BASE_URL_OVERRIDE=http://localhost:4010 DATAFORSEO_LIVE_ENABLED=true DATAFORSEO_LIVE_TOOLS=domain-overview npm run dev
```

Save any login and password in Settings, then open `/seo/domain-overview?q=fake.com`. The override is ignored when `NODE_ENV=production`.

DataForSEO also offers a free sandbox: set `DATAFORSEO_USE_SANDBOX=true` to hit `sandbox.dataforseo.com`.

### Known dev-server quirk

Next.js 16 `next dev` occasionally gets into a full-reload loop after many file edits ("[Fast Refresh] rebuilding" on every load). Restarting `npm run dev` fixes it. Production builds are not affected.

## Security notes

- This is single-tenant and has **no user authentication yet**. Do not expose it publicly until auth is added. The settings routes can change stored credentials.
- Never prefix DataForSEO variables with `NEXT_PUBLIC_`.

See **[docs/INTEGRATION.md](docs/INTEGRATION.md)** for the Phase 2 plan and the first integration.
