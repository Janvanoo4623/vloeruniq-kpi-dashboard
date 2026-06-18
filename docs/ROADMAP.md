# Roadmap & build status

Phased build. Status updated as we go.

## Phase 0 — Foundation & docs ✅
- [x] Scaffold Next.js 16 + TS + Tailwind 4.
- [x] Documentation (this `docs/` set + `CLAUDE.md`, `README.md`).
- [x] `.env.example`, gitignore for `.env.local` and `.data/`.

## Phase 1 — Teamleader data layer (`lib/`)  ⏳
- [ ] `lib/store.ts` — pluggable datastore (file | Upstash) for token / snapshot / meta / config.
- [ ] `lib/teamleader/auth.ts` — token refresh with rotation + persistence.
- [ ] `lib/teamleader/client.ts` — POST JSON client, pagination, 429 backoff, bounded concurrency.
- [ ] `lib/teamleader/price-map.ts` — default price map (ported `DEFAULT_PRICE_MAP`).
- [ ] `lib/teamleader/matching.ts` — floor-line detection, P-number/name match, margin.
- [ ] `lib/teamleader/quotations.ts` — fetch + parse quotations.
- [ ] `lib/teamleader/deals.ts` — customer lookup, won deals, run-time, write-back.
- [ ] `lib/teamleader/aggregate.ts` — weekly KPIs + lead sources → snapshot.
- [ ] `lib/teamleader/sync.ts` — orchestrates the whole pipeline.
- [ ] `lib/types.ts` — shared types (Snapshot, Quotation row, etc.).

## Phase 2 — API routes + sync job
- [ ] `scripts/sync.ts` + `npm run sync` (local, no timeout).
- [ ] `app/api/sync/route.ts` (cron + manual, `maxDuration`, lock, `CRON_SECRET`).
- [ ] `app/api/snapshot/route.ts`, `app/api/refresh/route.ts`.
- [ ] `app/api/login` + `app/api/logout`, `proxy.ts` password gate, `app/login/page.tsx`.
- [ ] `vercel.json` cron.

## Phase 3 — Dashboard UI
- [ ] KPI cards (revenue accepted/open, conversion, m², margin, avg run time, deals tracked).
- [ ] Weekly revenue bar chart (accepted vs open).
- [ ] Conversion + counts panel.
- [ ] Margin trend (€ and %) line/area.
- [ ] Lead-source donut.
- [ ] Run-time trend.
- [ ] Quotations table (sortable, status + verified badges, margin coverage).
- [ ] Refresh button + "last updated" indicator; loading/empty states; dark mode.

## Phase 4 — Verify & deploy
- [ ] Seed token; run a real sync; cross-check totals vs `DATA-MODEL.md` reference values.
- [ ] `npm run build` clean.
- [ ] Vercel project + Upstash + env + cron; client opens URL behind password.
- [ ] Regenerate `TEAMLEADER_CLIENT_SECRET`.

## Later / nice-to-have
- [ ] In-app price-map editor (Config-tab equivalent).
- [ ] Month/quarter views (data already carries month/quarter/year).
- [ ] Per-quotation drill-down (line items + which lines matched).
- [ ] Sync history / error log surfaced in the UI.
- [ ] CSV export.
