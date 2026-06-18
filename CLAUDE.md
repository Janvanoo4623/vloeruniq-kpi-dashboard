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
- **Never block page render on Teamleader.** The full sync takes ~3 minutes and is rate-limited.
  It runs only in `/api/sync` (cron / manual). The UI reads the precomputed snapshot.
- **Secrets live in `.env.local`** (gitignored) and Vercel env vars. Never hardcode the client
  secret or tokens. See `.env.example`.
- **Business numbers must match the Sheet.** When changing matching/margin logic, cross-check
  against the source spreadsheet values documented in `docs/DATA-MODEL.md`.

## Commands

```bash
npm run dev        # local dev server (reads snapshot from .data/)
npm run sync       # run the Teamleader sync locally (no timeout limits) -> writes .data/snapshot.json
npm run build      # production build
npm run lint       # eslint
```
