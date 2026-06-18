# Scope

## Background

Vloeruniq runs its sales pipeline in **Teamleader Focus** (CRM). Today, a Google Apps Script
(`KPI DASHBOARD V2`) periodically:

1. Refreshes a Teamleader OAuth token (stored in a `Tokens` sheet).
2. Pulls quotations (accepted / open / refused) and won deals over a 90-day window.
3. Matches quotation line items to purchase prices (via P-numbers like `P620` and product
   names like `VT Wonen Herringbone`) to compute **margin**.
4. Computes **run time** (lead time between deal-won and execution date) and **pushes it back**
   into Teamleader custom fields.
5. Writes everything to a Google Sheet (`Revenue`, `Run Time`, `Overview`, `Config`, `Log` tabs)
   with a weekly KPI overview.

The Sheet is functional but static and not pleasant to share with the client.

## Goal

Replace the Sheet-based experience with an **interactive web dashboard** that:

- Shows the same KPIs as the `Overview` tab, but as charts/tables (donuts, weekly bars,
  conversion, margin trend, lead-source breakdown, run-time trend, quotations table).
- Can be opened by **the owner (locally)** and **the client (any device)** behind a shared password.
- Has a **Refresh** button + scheduled auto-refresh so data stays current.
- Is **self-contained**: it pulls from Teamleader directly and no longer depends on the Sheet.

## In scope

- Full port of the Teamleader read pipeline (quotations, deals, customers, custom fields).
- Full port of the margin / P-number matching logic and the weekly aggregation.
- Run-time computation **and write-back** to Teamleader (custom field `doorlooptijd`).
- A configurable price map (the `Config` tab equivalent) editable without code changes.
- Snapshot storage + a dashboard that reads it.
- Password-gated hosting on Vercel.

## Out of scope (for now)

- Multi-user accounts / per-user permissions (single shared password only).
- Editing Teamleader records from the UI beyond the existing run-time write-back.
- Historical data beyond Teamleader's available window / the 90-day lookback (configurable).
- Mobile-native app (the web dashboard is responsive instead).

## Success criteria

1. `npm run sync` produces a snapshot whose totals **match the current Google Sheet** `Overview`
   tab (revenue accepted/open, counts, conversion %, m², margin €/%, avg run time, lead sources)
   within rounding. See `docs/DATA-MODEL.md` for the reference values.
2. The dashboard renders those KPIs interactively and loads in under ~1s (reads snapshot only).
3. The client can open a URL, enter one password, and see up-to-date numbers.
4. A refresh (manual or cron) updates the data without manual spreadsheet steps.
5. The Apps Script is fully retired (its trigger is already disabled).

## Key risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Teamleader rotates the refresh token; two owners invalidate each other | App is sole token owner; Apps Script trigger disabled (see `ARCHITECTURE.md`). |
| Full fetch is ~3 min, exceeds serverless limits | Sync is decoupled from rendering; bounded concurrency; `maxDuration` raised; local `npm run sync` fallback. |
| Rate limiting (HTTP 429) | Retry-after handling + concurrency cap, mirroring the script's backoff. |
| Margin numbers drift from the Sheet | Logic ported faithfully and cross-checked against documented reference values. |
| Secrets exposure | `.env.local` + Vercel env vars; client secret to be regenerated post-migration. |
