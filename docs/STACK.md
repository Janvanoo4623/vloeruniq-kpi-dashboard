# Tech stack

| Layer | Choice | Version | Why |
| --- | --- | --- | --- |
| Framework | Next.js (App Router) | 16.2.x | API routes + server-side secrets in one deploy; first-class Vercel support. |
| UI runtime | React | 19.2.x | Bundled with Next 16. |
| Language | TypeScript | 5.x | Type-safe port of the script's data shapes. |
| Styling | Tailwind CSS | 4.x | Fast, consistent dark-mode dashboard styling. |
| Charts | Recharts | 3.x | Interactive SVG charts (tooltips, responsive); supports React 19. |
| Datastore | Upstash Redis (prod) / JSON file (dev) | `@upstash/redis` | REST-based KV that works in serverless/edge; free tier; stores token + snapshot. |
| Scheduling | Vercel Cron | — | Periodic background sync without a separate server. |
| Auth | Cookie + shared password via `proxy.ts` | — | One password for owner + client; no user system needed. |
| Hosting | Vercel | — | Server routes for secrets; free tier covers this workload. |
| Runtime (sync) | Node.js | 24 (local), Node serverless (Vercel) | `fetch` built in; no extra HTTP client. |

## Notable version facts (verified against `node_modules/next/dist/docs`)

- **Next 16 renamed `middleware.ts` → `proxy.ts`.** Same functionality; lives at project root.
  We use it only for the lightweight password/cookie check (not for slow data fetching, per the docs).
- **Route Handlers** (`app/**/route.ts`) are **not cached by default** — correct for our dynamic
  `/api/sync`, `/api/snapshot`, `/api/refresh` endpoints. We do not opt into `force-static`.
- **Route segment config** `export const maxDuration = <seconds>` raises the function timeout for
  `/api/sync` (Vercel Hobby caps lower than Pro — see `DEPLOYMENT.md`).

## Dependencies we add (beyond the scaffold)

- `recharts` — charts.
- `@upstash/redis` — production datastore client (no-op in local file mode).
- `tsx` (dev) — run `scripts/sync.ts` directly for `npm run sync`.

## Deliberately avoided

- **No ORM / SQL database.** The data is a single computed snapshot (a few hundred rows); KV is enough.
- **No extra HTTP client (axios).** Native `fetch` covers Teamleader's JSON API.
- **No client-side Teamleader calls.** All secrets and fetching stay server-side.
- **No heavyweight auth provider.** A single shared password meets the requirement.
