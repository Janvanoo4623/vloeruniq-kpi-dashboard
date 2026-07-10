// Supabase data-access layer. All reads/writes go through here so the rest of
// the app stays storage-agnostic. Server-side only.
import { supabase } from './supabase';
import type { PriceRow, CostRow } from './pricing';
import type {
  QuotationRow,
  RunTimeRow,
  Snapshot,
  SyncMeta,
  TokenState,
} from './types';

const today = () => new Date().toISOString().split('T')[0];

export interface CurrentPrice {
  code: string;
  price: number;
  effectiveFrom: string;
}
export interface CurrentCost {
  key: string;
  value: number;
  effectiveFrom: string;
}
export interface Exclusion {
  id: string;
  reason: string | null;
  createdAt: string;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

// ── Token (single row id=1) ─────────────────────────────────────────────
export async function getToken(): Promise<TokenState | null> {
  const { data, error } = await supabase().from('token').select('*').eq('id', 1).maybeSingle();
  if (error) throw new Error(`db.getToken: ${error.message}`);
  if (!data) return null;
  return {
    refreshToken: data.refresh_token,
    accessToken: data.access_token ?? undefined,
    accessTokenExpiresAt: data.access_token_expires_at ?? undefined,
  };
}

export async function setToken(t: TokenState): Promise<void> {
  const { error } = await supabase().from('token').upsert({
    id: 1,
    refresh_token: t.refreshToken,
    access_token: t.accessToken ?? null,
    access_token_expires_at: t.accessTokenExpiresAt ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`db.setToken: ${error.message}`);
}

// ── Sync meta (single row id=1) ─────────────────────────────────────────
export async function getMeta(): Promise<SyncMeta | null> {
  const { data, error } = await supabase().from('sync_meta').select('*').eq('id', 1).maybeSingle();
  if (error) throw new Error(`db.getMeta: ${error.message}`);
  if (!data) return null;
  return {
    status: data.status,
    startedAt: data.started_at,
    lastSyncAt: data.last_sync_at,
    durationMs: data.duration_ms,
    counts: data.counts,
    error: data.error,
  };
}

export async function setMeta(m: SyncMeta): Promise<void> {
  const { error } = await supabase().from('sync_meta').upsert({
    id: 1,
    status: m.status,
    started_at: m.startedAt,
    last_sync_at: m.lastSyncAt,
    duration_ms: m.durationMs,
    counts: m.counts,
    error: m.error,
  });
  if (error) throw new Error(`db.setMeta: ${error.message}`);
}

// ── Prices / costs / exclusions ─────────────────────────────────────────
export async function getPriceRows(): Promise<PriceRow[]> {
  const { data, error } = await supabase().from('product_prices').select('code, price, effective_from');
  if (error) throw new Error(`db.getPriceRows: ${error.message}`);
  return (data ?? []).map((r) => ({
    code: r.code,
    price: num(r.price),
    effectiveFrom: r.effective_from,
  }));
}

export async function getCostRows(): Promise<CostRow[]> {
  const { data, error } = await supabase().from('cost_settings').select('key, value, effective_from');
  if (error) throw new Error(`db.getCostRows: ${error.message}`);
  return (data ?? []).map((r) => ({
    key: r.key,
    value: num(r.value),
    effectiveFrom: r.effective_from,
  }));
}

export async function getExclusions(): Promise<Set<string>> {
  const { data, error } = await supabase().from('excluded_quotations').select('id');
  if (error) throw new Error(`db.getExclusions: ${error.message}`);
  return new Set((data ?? []).map((r) => r.id));
}

// ── Quotations (accumulated) ────────────────────────────────────────────
function quotationToRow(q: QuotationRow) {
  return {
    id: q.id,
    name: q.name,
    deal_id: q.dealId,
    customer_name: q.customerName,
    city: q.city,
    postal_code: q.postalCode,
    status: q.status,
    date_created: q.dateCreated || null,
    date_accepted: q.dateAccepted || null,
    revenue_ex_vat: q.revenueExVat,
    revenue_incl_vat: q.revenueInclVat,
    omzet_vloer: q.omzetVloer,
    total_m2: q.totalM2,
    cost: q.cost,
    margin: q.margin,
    margin_pct: q.marginPct,
    match_coverage: q.matchCoverage,
    verified: q.verified,
    lines: q.lines ?? [],
    synced_at: new Date().toISOString(),
  };
}

export async function upsertQuotations(rows: QuotationRow[]): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map(quotationToRow);
  // Chunk to stay well under payload limits.
  for (let i = 0; i < payload.length; i += 500) {
    const { error } = await supabase().from('quotations').upsert(payload.slice(i, i + 500));
    if (error) throw new Error(`db.upsertQuotations: ${error.message}`);
  }
}

export async function upsertDeals(rows: RunTimeRow[]): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map((d) => ({
    id: d.dealId,
    title: d.title,
    date_accepted: d.dateAccepted || null,
    date_execution: d.dateExecution || null,
    run_time_days: d.runTimeDays,
    lead_source: d.leadSource,
    synced_at: new Date().toISOString(),
  }));
  for (let i = 0; i < payload.length; i += 500) {
    const { error } = await supabase().from('deals').upsert(payload.slice(i, i + 500));
    if (error) throw new Error(`db.upsertDeals: ${error.message}`);
  }
}

// ── Snapshot cache (single row) ─────────────────────────────────────────
export async function getSnapshot(): Promise<Snapshot | null> {
  const { data, error } = await supabase().from('snapshot_cache').select('data').eq('id', 1).maybeSingle();
  if (error) throw new Error(`db.getSnapshot: ${error.message}`);
  return (data?.data as Snapshot) ?? null;
}

export async function setSnapshot(snapshot: Snapshot): Promise<void> {
  const { error } = await supabase()
    .from('snapshot_cache')
    .upsert({ id: 1, data: snapshot, updated_at: new Date().toISOString() });
  if (error) throw new Error(`db.setSnapshot: ${error.message}`);
}

// ── Settings: current prices / costs (date-effective) ───────────────────
/** Current effective price per product code (as of today). */
export async function getCurrentPrices(): Promise<CurrentPrice[]> {
  const rows = await getPriceRows();
  const d = today();
  const byCode = new Map<string, { price: number; effectiveFrom: string }>();
  for (const r of rows) {
    if (r.effectiveFrom > d) continue; // not yet effective
    const cur = byCode.get(r.code);
    if (!cur || r.effectiveFrom > cur.effectiveFrom) {
      byCode.set(r.code, { price: r.price, effectiveFrom: r.effectiveFrom });
    }
  }
  return [...byCode.entries()]
    .map(([code, v]) => ({ code, price: v.price, effectiveFrom: v.effectiveFrom }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** Insert a new effective-dated price (default: effective today). */
export async function addPrice(code: string, price: number, effectiveFrom?: string): Promise<void> {
  const { error } = await supabase()
    .from('product_prices')
    .insert({ code: code.trim(), price, effective_from: effectiveFrom ?? today() });
  if (error) throw new Error(`db.addPrice: ${error.message}`);
}

/** Current effective cost per key (labor/primer/glue/leveling). */
export async function getCurrentCosts(): Promise<CurrentCost[]> {
  const rows = await getCostRows();
  const d = today();
  const byKey = new Map<string, { value: number; effectiveFrom: string }>();
  for (const r of rows) {
    if (r.effectiveFrom > d) continue;
    const cur = byKey.get(r.key);
    if (!cur || r.effectiveFrom > cur.effectiveFrom) {
      byKey.set(r.key, { value: r.value, effectiveFrom: r.effectiveFrom });
    }
  }
  return [...byKey.entries()]
    .map(([key, v]) => ({ key, value: v.value, effectiveFrom: v.effectiveFrom }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export async function addCost(key: string, value: number, effectiveFrom?: string): Promise<void> {
  const { error } = await supabase()
    .from('cost_settings')
    .insert({ key: key.trim(), value, effective_from: effectiveFrom ?? today() });
  if (error) throw new Error(`db.addCost: ${error.message}`);
}

// ── Settings: exclusions ────────────────────────────────────────────────
export async function listExclusions(): Promise<Exclusion[]> {
  const { data, error } = await supabase()
    .from('excluded_quotations')
    .select('id, reason, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`db.listExclusions: ${error.message}`);
  return (data ?? []).map((r) => ({ id: r.id, reason: r.reason, createdAt: r.created_at }));
}

export async function addExclusion(id: string, reason: string | null): Promise<void> {
  const { error } = await supabase()
    .from('excluded_quotations')
    .upsert({ id: id.trim(), reason: reason?.trim() || null });
  if (error) throw new Error(`db.addExclusion: ${error.message}`);
}

export async function removeExclusion(id: string): Promise<void> {
  const { error } = await supabase().from('excluded_quotations').delete().eq('id', id);
  if (error) throw new Error(`db.removeExclusion: ${error.message}`);
}

// Re-export the numeric coercers for callers that read raw rows.
export { num as _num, numOrNull as _numOrNull };
