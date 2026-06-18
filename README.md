# Vloeruniq KPI Dashboard

Interactive KPI dashboard for Vloeruniq, replacing a Google Apps Script + Google Sheets
pipeline with a self-contained Next.js app. It pulls data from **Teamleader Focus**, computes
revenue / margin / conversion / run-time KPIs, and renders an interactive dashboard.

> Full documentation lives in [`docs/`](./docs). Start with [`docs/SCOPE.md`](./docs/SCOPE.md)
> and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Quick start (local)

```bash
npm install
cp .env.example .env.local      # then fill in your Teamleader credentials + token
npm run sync                    # pull from Teamleader -> writes .data/snapshot.json (~3 min)
npm run dev                     # open http://localhost:3000
```

The dashboard reads the snapshot produced by `npm run sync`. Run `sync` whenever you want fresh
data locally; in production a Vercel Cron job and a "Refresh" button do this for you.

## How it works (one paragraph)

A slow, rate-limited **sync** job talks to Teamleader, computes every KPI, and writes a single
JSON **snapshot** to a datastore (local file in dev, Upstash Redis in prod). The **dashboard**
only ever reads that snapshot, so it loads instantly and never blocks on the 3-minute fetch.
Access is gated by a single shared password (cookie-based). See
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run sync` | Run the Teamleader sync locally (~80s, no serverless timeout) |
| `npm run seed:demo` | Write a demo snapshot to preview the UI without live data |
| `npm run import:config` | Import the Sheet's `Config` price map (`config.tsv`) for exact margins |
| `npm run build` | Production build |
| `npm run start` | Run the production build locally |
| `npm run lint` | ESLint |

See [`docs/RUNBOOK.md`](./docs/RUNBOOK.md) for operating details (token storage, refresh, troubleshooting).

## Project layout

```
app/                  # Next.js App Router — dashboard pages + /api routes
  api/sync/           # the heavy Teamleader pipeline (cron / manual)
  api/snapshot/       # read the computed snapshot for the UI
  api/refresh/        # trigger a sync
  login/              # password gate
components/           # dashboard UI (cards, charts, tables)
lib/teamleader/       # OAuth, API client, fetchers, matching, aggregation
lib/store.ts          # pluggable datastore (file | Upstash)
scripts/sync.ts       # CLI entry for `npm run sync`
proxy.ts              # password auth (Next 16's renamed middleware)
docs/                 # all project documentation
```

## Deployment

Deployed to **Vercel** with **Upstash Redis** for storage, gated by a shared password.
Step-by-step in [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md).
