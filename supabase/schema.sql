-- Vloeruniq KPI Dashboard — Supabase (Postgres) schema (v2)
-- Run this in the Supabase SQL editor once. Safe to re-run (idempotent).
-- All access is server-side via the service-role key, which bypasses RLS.

-- Rotating Teamleader OAuth token (single row).
create table if not exists token (
  id int primary key default 1,
  refresh_token text not null,
  access_token text,
  access_token_expires_at bigint,
  updated_at timestamptz default now(),
  constraint token_singleton check (id = 1)
);

-- Sync status / metadata (single row).
create table if not exists sync_meta (
  id int primary key default 1,
  status text,
  started_at timestamptz,
  last_sync_at timestamptz,
  duration_ms int,
  counts jsonb,
  error text,
  constraint sync_meta_singleton check (id = 1)
);

-- Effective-dated purchase prices per product code (P-number or product name).
-- Editing a price = insert a new row with effective_from = today. A quotation
-- uses the price whose effective_from is on/before the quotation's date, so
-- changes never affect older quotations (non-retroactive).
create table if not exists product_prices (
  id bigserial primary key,
  code text not null,
  price numeric not null,
  effective_from date not null default current_date,
  created_at timestamptz default now()
);
create index if not exists product_prices_code_eff
  on product_prices (lower(code), effective_from desc);

-- Effective-dated cost settings: 'labor' | 'primer' | 'glue' | 'leveling' (€/m²).
create table if not exists cost_settings (
  id bigserial primary key,
  key text not null,
  value numeric not null,
  effective_from date not null default current_date,
  created_at timestamptz default now()
);
create index if not exists cost_settings_key_eff
  on cost_settings (key, effective_from desc);

-- Quotation IDs to exclude from all aggregates.
create table if not exists excluded_quotations (
  id text primary key,
  reason text,
  created_at timestamptz default now()
);

-- Accumulated quotations (all history). Margin is computed at sync time using
-- the date-effective prices for each quotation's date.
create table if not exists quotations (
  id text primary key,
  name text,
  deal_id text,
  customer_name text,
  city text,
  postal_code text,
  status text,                 -- accepted | open | refused
  date_created date,
  date_accepted date,
  revenue_ex_vat numeric,
  revenue_incl_vat numeric,
  omzet_vloer numeric,
  total_m2 numeric,
  cost numeric,
  margin numeric,
  margin_pct numeric,
  match_coverage numeric,
  verified boolean,
  lines jsonb,                 -- [{ code, revenue, m2, margin }]
  synced_at timestamptz default now()
);
create index if not exists quotations_date
  on quotations (coalesce(date_accepted, date_created));
create index if not exists quotations_status on quotations (status);

-- Offertes die niet meer in Teamleader staan (bron geeft 404). We bewaren de rij
-- maar houden hem overal uit de aggregaties; alleen een volledige backfill kan
-- dit vaststellen, want de 90-daagse sync ziet oudere offertes sowieso niet.
alter table quotations add column if not exists deleted_at_source boolean default false;

-- Accumulated won deals (run-time / doorlooptijd).
create table if not exists deals (
  id text primary key,
  title text,
  date_accepted date,          -- closed_at
  date_execution date,
  run_time_days int,
  lead_source text,
  synced_at timestamptz default now()
);
create index if not exists deals_date on deals (date_accepted);

-- Invoices (for quoted-vs-invoiced, period-filterable).
create table if not exists invoices (
  id text primary key,
  invoice_date date,
  status text,           -- draft | booked | outstanding | ...
  paid boolean,
  total_excl numeric,    -- ex VAT
  due_incl numeric,      -- outstanding amount incl VAT
  customer_id text,
  synced_at timestamptz default now()
);
create index if not exists invoices_date on invoices (invoice_date);
alter table invoices add column if not exists due_on date;         -- vervaldatum
alter table invoices add column if not exists customer_name text;  -- factuur-tenaamstelling
alter table invoices add column if not exists paid_at date;        -- betaaldatum (voor betaaltermijn/DSO)

-- Per-quotation manual corrections (feedback Jan 2026-07-13):
--  * a per-line special purchase price (€/m²) for a one-off deal, e.g. the
--    voetbalkantine 800 m² special buy — applies ONLY to that quotation;
--  * an offerte-level "los verkocht — geen legservice" flag that drops the
--    labour cost (€17/m²) for a floor sold without installation.
-- Applied at read time (instant + retroactive), only to quotations that have a
-- row here; all other quotations keep their synced margins unchanged.
-- line_code = '' denotes the offerte-level row that carries no_labor / note.
create table if not exists quotation_overrides (
  quotation_id text not null,
  line_code text not null default '',   -- '' = offerte-niveau; anders per vloerregel (P-nr/naam)
  purchase_per_m2 numeric,              -- afwijkende inkoopprijs €/m² (per regel)
  no_labor boolean not null default false, -- los verkocht: geen legservice (offerte-niveau)
  note text,
  updated_at timestamptz default now(),
  primary key (quotation_id, line_code)
);

-- Cached computed snapshot (single row) for fast dashboard reads.
create table if not exists snapshot_cache (
  id int primary key default 1,
  data jsonb,
  updated_at timestamptz default now(),
  constraint snapshot_cache_singleton check (id = 1)
);
