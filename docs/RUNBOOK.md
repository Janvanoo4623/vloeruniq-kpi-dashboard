# Runbook (operating the dashboard)

Day-to-day operations: scripts, how the token is stored, how refresh works, and
troubleshooting. For first-time deployment see `DEPLOYMENT.md`.

## npm scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Local dev server (reads the snapshot from `.data/`). |
| `npm run sync` | Run the full Teamleader pipeline locally (~80s) and write a fresh snapshot. No serverless timeout. |
| `npm run seed:demo` | Write a fabricated DEMO snapshot so the UI can be viewed without live Teamleader access. |
| `npm run import:config` | Import the Sheet's `Config` price map (from `config.tsv`) so margins match the Sheet exactly. |
| `npm run build` | Production build. |
| `npm run start` | Serve the production build locally. |
| `npm run lint` | ESLint. |

## How the refresh token is stored (and why it "just works" now)

The original Apps Script kept the Teamleader refresh token in the Sheet's `Tokens` tab.
This app keeps it in the **datastore** instead:

- **Local:** `.data/token.json`
- **Production:** Upstash Redis (key `vloeruniq:token`)

Teamleader uses **rotating** refresh tokens: each refresh returns a brand-new refresh token
and invalidates the previous one. So every sync does this, automatically:

1. Read the current refresh token from the store.
2. Exchange it for a fresh access token **and a new refresh token**.
3. **Write the new refresh token back to the store immediately.**

Because the store always holds the latest token, **you can run `npm run sync` (or let the cron
run) as often as you like — no Apps Script, no Sheet, no manual token steps.** The
`TEAMLEADER_REFRESH_TOKEN` env var is only a one-time **seed**: it's used solely when the store
has no token yet (first run), after which the store is the single source of truth and the env
value is ignored.

> ⚠️ Only ONE system may hold the token, because rotation invalidates old copies. This app is
> now the sole owner; the old Apps Script trigger is disabled. Never re-enable it. (The Sheet's
> stored token is already dead — it was rotated on the first sync. That's expected.)

The access token is cached in the store with its expiry and reused until ~60s before it expires,
so repeated syncs within an hour don't trigger extra refreshes. Concurrent calls are serialized
so two refreshes can never race.

## Refreshing data

- **Automatically:** Vercel Cron hits `/api/sync` on the schedule in `vercel.json`.
- **From the UI:** the **Vernieuwen** button calls `/api/refresh`, which runs a sync and reloads
  the page. It can take ~80s (Teamleader is rate-limited); a spinner shows meanwhile.
- **From the CLI:** `npm run sync`.

Only one sync runs at a time — a second request while one is running returns `409` ("loopt al").

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `No Teamleader refresh token available` | Store is empty and no seed env var. Put the current token in `TEAMLEADER_REFRESH_TOKEN` and run `npm run sync` once. |
| Token refresh fails (`invalid_grant`) | The stored token was invalidated (e.g. the old Apps Script ran, or a second deploy refreshed it). Re-seed a fresh token from Teamleader and run once. **Only one owner.** |
| Margins don't match the Sheet | The app is using default prices. Run `npm run import:config` with your `Config` tab, then `npm run sync`. |
| Dashboard shows "Nog geen data" | No snapshot yet. Run `npm run sync` (or `npm run seed:demo` for a preview). |
| Sync times out on Vercel | The function exceeded the plan's max duration. Run `npm run sync` locally, or raise the plan / `maxDuration`. See `DEPLOYMENT.md`. |
| HTTP 429 in logs | Teamleader rate limit. The client backs off and retries automatically; just let it finish. |
