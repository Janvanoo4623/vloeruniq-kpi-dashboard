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
