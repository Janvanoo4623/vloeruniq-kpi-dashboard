# Deployment

Target: **Vercel (Hobby/free)** for hosting + **Upstash Redis** for storage, gated by a shared
password. The heavy ~80s Teamleader sync runs in **GitHub Actions** (not on Vercel), because
Vercel Hobby caps functions at 60s. Vercel only *reads* the snapshot from Upstash.

> If the client later upgrades to **Vercel Pro**, the in-app sync/cron also works (raise
> `maxDuration`, re-add a `vercel.json` cron). For now we assume Hobby + GitHub Actions.

## Architecture on Hobby

```
GitHub Actions (schedule + manual)  ──run npm run sync──▶  Upstash Redis  ◀──read──  Vercel app
            │                                               (token + snapshot)
            └─ triggered by the dashboard "Vernieuwen" button (workflow_dispatch)
```

Single token owner = **the Upstash store, written only by GitHub Actions.** Never also run a
local `npm run sync` against the same Upstash, and never re-enable the old Apps Script — rotating
refresh tokens would invalidate each other.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `TEAMLEADER_CLIENT_ID` | Vercel + GitHub Actions | OAuth client ID |
| `TEAMLEADER_CLIENT_SECRET` | Vercel + GitHub Actions | OAuth client secret (**regenerate after migration**) |
| `TEAMLEADER_REFRESH_TOKEN` | GitHub Actions (seed only) | Current token; used once to bootstrap Upstash, then ignored |
| `TEAMLEADER_WRITEBACK` | GitHub Actions | `false` to disable doorlooptijd write-back (optional) |
| `DASHBOARD_PASSWORD` | Vercel | The single shared password |
| `AUTH_COOKIE_SECRET` | Vercel | Random string (`openssl rand -hex 32`) to sign the auth cookie |
| `UPSTASH_REDIS_REST_URL` | Vercel + GitHub Actions | Upstash REST URL — presence switches the store to Redis |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel + GitHub Actions | Upstash REST token |
| `GITHUB_REPO` | Vercel | `owner/name` — lets the Vernieuwen button trigger the workflow |
| `GITHUB_DISPATCH_TOKEN` | Vercel | Fine-grained PAT with **Actions: write** on the repo (for the button) |

> The Upstash vars live in **both** places: Vercel reads the snapshot, GitHub Actions writes it.
> `GITHUB_REPO` + `GITHUB_DISPATCH_TOKEN` are only for the manual button; omit them and the button
> simply won't trigger (the scheduled sync still runs).

## GitHub Actions sync route

`.github/workflows/sync.yml` runs `npm run sync` on a schedule and on manual/dispatch trigger,
writing to Upstash. Set these as **GitHub repo secrets** (Settings → Secrets and variables →
Actions): `TEAMLEADER_CLIENT_ID`, `TEAMLEADER_CLIENT_SECRET`, `TEAMLEADER_REFRESH_TOKEN`,
`TEAMLEADER_WRITEBACK` (optional), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

- Schedule: edit the `cron:` lines in the workflow (UTC).
- Manual: Actions tab → *Teamleader sync* → *Run workflow*, or the dashboard **Vernieuwen** button
  (which calls `/api/refresh` → `workflow_dispatch`).
- A `concurrency` group guarantees two syncs never run at once.

## One-time token seeding

The valid, current refresh token is in your local `.data/token.json` (local syncs rotated it —
the value in `.env.local` is stale). Copy that into the **`TEAMLEADER_REFRESH_TOKEN` GitHub
secret**. The first workflow run adopts it, refreshes, and stores the rotated token in Upstash;
from then on Upstash is the source of truth and the secret is ignored.

## Setting up Upstash (storage)

1. Vercel → Storage → **Create Database → Upstash Redis** (Marketplace, free tier).
2. Connect it to the project; Vercel injects `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
3. Copy those two values into the **GitHub repo secrets** too (so Actions writes to the same store).

## Password gate

`proxy.ts` redirects unauthenticated requests to `/login`; enter the shared password once → cookie
set → dashboard. To rotate access, change `DASHBOARD_PASSWORD` (and/or `AUTH_COOKIE_SECRET` to
invalidate existing cookies) and redeploy.

## Deploy steps (summary)

```text
1.  Client creates GitHub + Vercel accounts, invites the developer.
2.  Push repo to GitHub.
3.  Vercel → New Project → import the repo.
4.  Vercel → Storage → add Upstash Redis.
5.  Set Vercel env vars (table above).
6.  Set GitHub repo secrets (Teamleader + Upstash), seed token from .data/token.json.
7.  Run the GitHub Actions "Teamleader sync" workflow once → fills Upstash.
8.  Open the Vercel URL, log in, confirm the KPIs.
9.  Stop running local `npm run sync` against this Upstash (single owner = Actions).
10. Regenerate TEAMLEADER_CLIENT_SECRET in Teamleader; update Vercel + GitHub secrets.
```
