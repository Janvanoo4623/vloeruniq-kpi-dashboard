# Architecture

## High-level data flow

```
                    ┌──────────────────────────────────────────────┐
   trigger          │                 SYNC JOB                      │
 ┌──────────┐       │  /api/sync  (or  npm run sync  locally)       │
 │ Vercel   │──────▶│                                               │
 │ Cron     │       │  1. refresh OAuth token  ──────────┐          │
 └──────────┘       │  2. fetch quotations/deals/customers│          │
 ┌──────────┐       │  3. match P-numbers → margin        │          │
 │ Refresh  │──────▶│  4. compute run-time + write back   │          │
 │ button   │       │  5. aggregate weekly KPIs           │          │
 └──────────┘       │  6. write snapshot ────────┐        │          │
                    └────────────────────────────┼────────┼──────────┘
                                                 │        │
                              ┌──────────────────▼────────▼──────────┐
                              │            DATASTORE                  │
                              │  token   |  snapshot.json  |  meta    │
                              └──────────────────┬────────────────────┘
                                                 │ read
                    ┌────────────────────────────▼──────────────────┐
                    │              DASHBOARD (App Router)            │
   client/owner ───▶│  proxy.ts password gate → pages read snapshot  │
                    │  KPI cards · charts · tables (Recharts)        │
                    └────────────────────────────────────────────────┘
                                ▲ write-back (doorlooptijd)
                                └──────────────▶ Teamleader Focus API
```

## The two-process model

There are exactly two responsibilities, deliberately decoupled:

1. **Sync (slow, ~3 min, rate-limited).** Talks to Teamleader, does all computation, writes one
   snapshot. Runs on a schedule (Vercel Cron) or on demand (Refresh button / `npm run sync`).
   Never runs during a page render.
2. **Render (fast, <1s).** Reads only the snapshot from the datastore. No Teamleader calls.

This is the core design decision. It exists because the Teamleader fetch is far too slow and
rate-limited to run inside a page request, and because serverless functions have execution-time
limits.

## THE TOKEN-OWNERSHIP RULE (read this)

Teamleader OAuth uses **rotating refresh tokens**: each call to the token endpoint returns a
**new** refresh token and **invalidates the previous one**. Therefore:

> **Only one system may ever refresh the Teamleader token.**

The original Apps Script owned the token (stored in a `Tokens` sheet). This app now owns it
instead. The Apps Script's time-based trigger **has been disabled** so the two never fight.

Consequences for this codebase:
- The current refresh token is **seeded once** into the datastore (`scripts/seed-token.ts` or a
  one-time `.env` value the store reads on first run).
- After that, the datastore is the single source of truth for the token. Each sync reads the
  current refresh token, refreshes it, and **writes the new refresh token back** before doing
  any other work.
- Token writes must be durable. In dev that's `.data/token.json`; in prod it's Upstash Redis.
  This is why we cannot store the rotating token in a Vercel env var (env vars are immutable at
  runtime).

## Datastore abstraction

`lib/store.ts` exposes a small interface so the rest of the code is storage-agnostic:

```ts
getToken()    / setToken(token)       // rotating Teamleader refresh token + access token cache
getSnapshot() / setSnapshot(snapshot) // the computed KPI snapshot the UI reads
getMeta()     / setMeta(meta)         // last sync time, status, row counts, errors
getConfig()   / setConfig(priceMap)   // editable price map (Config-tab equivalent)
```

- **Local/dev:** backed by JSON files under `.data/` (gitignored).
- **Production:** backed by Upstash Redis. Selected automatically when `UPSTASH_REDIS_REST_URL`
  is present; otherwise falls back to the file backend.

## Auth (shared password)

`proxy.ts` (Next 16's renamed middleware) checks for a signed auth cookie on every non-public
route. Missing/invalid → redirect to `/login`. `/login` posts the password to a route handler
that compares against `DASHBOARD_PASSWORD` and sets the cookie. Per the Next docs, `proxy.ts`
does only this lightweight check — no data fetching.

Public (no auth) paths: `/login`, the login POST route, static assets, and the cron endpoint
(which is instead protected by a `CRON_SECRET`).

## Why not the alternatives (recorded for posterity)

- **Read from the Google Sheet instead of Teamleader** — rejected: the goal is a self-contained
  app with no Sheet dependency. (It remains a valid fallback if Teamleader access lapses.)
- **Fetch Teamleader live on page load** — impossible: ~3 min + rate limits + serverless timeouts.
- **Store token in env var** — impossible: the token rotates and must be writable at runtime.
- **SQL database** — overkill: the snapshot is small; KV suffices.
