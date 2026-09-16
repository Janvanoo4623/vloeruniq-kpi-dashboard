@AGENTS.md

# Vloeruniq KPI Dashboard

An interactive KPI dashboard for **Vloeruniq** (a flooring / PVC installation business),
porting an existing Google Apps Script + Google Sheets pipeline into a self-contained
Next.js app deployed on Vercel.

The original Apps Script pulled data from **Teamleader Focus** (CRM), computed revenue /
margin / run-time KPIs, and wrote them to a Google Sheet. This project replaces that with
a live web dashboard the business owner and his client can view on any device.

## What this app does

1. **Syncs** data from the Teamleader Focus API (quotations, deals, customers, custom fields).
2. **Computes** KPIs: revenue by status, conversion rate, m² sold, margin (via P-number /
   product-name → purchase-price matching), average run time, and revenue per lead source.
3. **Stores** the computed snapshot in a datastore (local JSON file in dev, Upstash Redis in prod).
4. **Renders** an interactive dashboard (charts, tables) that reads only the snapshot — so pages
   load instantly and never block on the slow Teamleader fetch.
5. **Writes back** run-time ("doorlooptijd") values to Teamleader, mirroring the original script.
6. **Marketing** (since 2026-09-16): Google Ads day-level cost per campaign lands in `ads_daily`
   on every Vernieuwen/cron (GAQL.app REST, `lib/ads-sync.ts`, no Teamleader lock); the Marketing tab shows cost, CTR/CPC, conversions, monthly budget and
   **margin after Google Ads**. See `docs/DATA-MODEL.md` "Marketing".

## Read these first

- `docs/SCOPE.md` — what we're building and why, success criteria.
- `docs/ARCHITECTURE.md` — system design, data flow, the **token-ownership rule**.
- `docs/STACK.md` — tech choices and versions.
- `docs/DATA-MODEL.md` — **the business logic** (matching, margin, run-time) ported from the script.
- `docs/API.md` — Teamleader endpoints used + this app's internal API routes.
- `docs/DEPLOYMENT.md` — Vercel + Upstash + env vars + password auth.
- `docs/ROADMAP.md` — build phases and status.

## Critical rules for working in this repo

- **This is Next.js 16** (see `AGENTS.md`). Conventions changed from older versions — notably
  `middleware.ts` is now **`proxy.ts`**. Read `node_modules/next/dist/docs/` before writing
  framework code.
- **Only one system may own the Teamleader refresh token.** Teamleader rotates the refresh
  token on every refresh and invalidates the old one. This app is now the sole owner; the
  original Apps Script trigger has been disabled. Never refresh the token from two places.
  **This includes the app against itself:** a backfill and the cron running at the same time
  will revoke each other's token. Every process that talks to Teamleader must claim the lock
  (`db.acquireSyncLock`) — see `docs/ARCHITECTURE.md`. Before starting a sync or backfill by
  hand, verify nothing else is running; do not rely on a single `pgrep` check.
  **`force` means TAKE OVER the lock, never skip it.** `npm run sync` used to pass `force: true`
  and bypass locking entirely; on 2026-09-12 it ran alongside the 12:00 cron and Teamleader
  revoked the refresh token, which stopped every sync until a new token was fetched with
  `npm run oauth`. A revoked token always means two processes refreshed it — look for the second
  one, do not just re-authorise and move on.
- **Never block page render on Teamleader.** The full sync takes ~3 minutes and is rate-limited.
  It runs only in `/api/sync` (cron / manual). The UI reads the precomputed snapshot.
- **Secrets live in `.env.local`** (gitignored) and Vercel env vars. Never hardcode the client
  secret or tokens. See `.env.example`.
- **Business numbers must match the Sheet.** When changing matching/margin logic, cross-check
  against the source spreadsheet values documented in `docs/DATA-MODEL.md`.
- **Margins are computed at read time, not at sync time** (`lib/resolve.ts`, since 2026-09-09).
  Prices and costs are resolved per quotation date from `product_prices` / `cost_settings`, so a
  price edit works immediately and its `effective_from` decides how far back it reaches. When you
  touch that resolver, diff every stored margin before and after and make each change explainable
  from a price or cost row — that check is what proved the port correct on all 843 quotations.

## Commands

```bash
npm run dev        # local dev server (reads snapshot from .data/)
npm run sync       # run the Teamleader sync locally (no timeout limits) -> writes .data/snapshot.json
npm run sync:ads   # Google Ads dagcijfers -> Supabase ads_daily, verder terug dan de 90 dagen van Vernieuwen (--days, --from-json)
npm run ads:token  # test de GAQL-koppeling uit .env.local en zet hem in Supabase (app_settings.ads_gaql) voor Vernieuwen/cron op Vercel
npm run build      # production build
npm run lint       # eslint
```
