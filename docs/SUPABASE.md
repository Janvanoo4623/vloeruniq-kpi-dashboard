# Supabase datastore (v2)

From v2 the app stores everything in **Supabase (Postgres)** instead of Upstash: the
Teamleader token, all accumulated quotations/deals, the editable **date-effective** price
list + cost settings, and the excluded-quotation list. This powers the Settings UI, longer
date ranges, period comparison, and trends.

## Why Postgres (not Upstash)
Editable config with history, excluded IDs, and querying arbitrary date ranges are relational
problems. Upstash (key-value) held a single snapshot fine, but doesn't fit v2. Supabase gives
us SQL tables, a free tier, and a simple JS client.

## Setup (client creates the project, developer is collaborator)

1. **Create a Supabase project** at https://supabase.com (free tier). Region: **EU (Frankfurt)**.
   Save the database password.
2. **Run the schema**: Supabase → **SQL Editor** → paste the contents of
   [`supabase/schema.sql`](../supabase/schema.sql) → **Run**. (Idempotent; safe to re-run.)
3. **Get the credentials**: Supabase → **Project Settings → API**:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** secret key → `SUPABASE_SERVICE_ROLE_KEY` (server-side only — never expose client-side)
4. **Set env vars** in Vercel (project → Settings → Environment Variables) and, for local dev,
   in `.env.local`:
   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
   > If you connect Supabase via the Vercel Marketplace integration instead, it may inject
   > `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — the client supports both names.
5. Invite the developer to the Supabase project (Organization → Members).

## Seeding the initial prices/costs

The current default prices and cost constants are seeded once into `product_prices` /
`cost_settings` with an early `effective_from` (so all historical quotations get a price).
This is done by the migration/seed script (Phase 1). After that, edits happen through the
Settings UI and are date-effective from the edit date.

## Access model
All access is **server-side** through the service-role key (which bypasses RLS). The browser
never talks to Supabase directly; the dashboard and Settings UI go through the app's API routes.
Row-Level Security can stay disabled on these tables.

## Env vars summary (v2)

| Variable | Where | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Vercel + local | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + local | Service-role key (server-only) |

The Upstash vars (`UPSTASH_*` / `KV_*`) are no longer used once Supabase is configured.
