// Supabase data-access layer. All reads/writes go through here so the rest of
// the app stays storage-agnostic. Server-side only.
import { supabase } from './supabase';
import { deriveDateParts } from './teamleader/dates';
import type { PriceRow, CostRow } from './pricing';
import type {
  InvoiceRow,
  QuotationLine,
  QuotationOverride,
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

/**
 * Bestaat de tabel (nog) niet? Postgres zegt 42P01 "does not exist", maar
 * PostgREST antwoordt met PGRST205 en "Could not find the table ... in the
 * schema cache". Allebei betekenen: migratie nog niet gedraaid.
 */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /does not exist|could not find the table/i.test(error.message ?? '')
  );
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
    // deleted_at_source bewust NIET meegeschreven: de kolom wordt met een losse
    // migratie toegevoegd, en tot die tijd zou een upsert erop de hele sync laten
    // vallen. markDeletedAtSource zet hem terug op false als een offerte weer
    // opduikt — dat is de enige plek die er iets over mag beweren.
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

// ── App-instellingen (KPI-definities) ───────────────────────────────────
/**
 * Vrije sleutel/waarde-tabel voor instellingen die geen prijs of kostenpost zijn.
 * Ontbreekt de tabel nog (migratie niet gedraaid), dan vallen we terug op de
 * standaardwaarden in plaats van de hele pagina te laten vallen.
 */
export async function getAppSetting<T>(key: string, fallback: T): Promise<T> {
  const { data, error } = await supabase()
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return fallback;
    throw new Error(`db.getAppSetting(${key}): ${error.message}`);
  }
  return (data?.value as T) ?? fallback;
}

export async function setAppSetting(key: string, value: unknown): Promise<void> {
  const { error } = await supabase()
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) {
    if (isMissingTable(error)) {
      throw new Error(
        'De tabel app_settings bestaat nog niet. Draai de migratie uit supabase/schema.sql in de Supabase SQL editor.',
      );
    }
    throw new Error(`db.setAppSetting(${key}): ${error.message}`);
  }
}

// ── Per-quotation overrides (special price / no-labour) ─────────────────
/** All overrides keyed by quotation id. line_code '' carries the offerte-level flag. */
export async function getOverrides(): Promise<Record<string, QuotationOverride>> {
  const { data, error } = await supabase()
    .from('quotation_overrides')
    .select('quotation_id, line_code, purchase_per_m2, no_labor, note');
  if (error) {
    // Table not created yet (migration pending): degrade gracefully so the
    // dashboard keeps working with no corrections applied.
    if (isMissingTable(error)) return {};
    throw new Error(`db.getOverrides: ${error.message}`);
  }
  const out: Record<string, QuotationOverride> = {};
  for (const r of data ?? []) {
    const qid = r.quotation_id as string;
    const ov = (out[qid] ??= { noLabor: false, prices: {} });
    const code = (r.line_code as string) ?? '';
    if (code === '') {
      ov.noLabor = Boolean(r.no_labor);
      if (r.note) ov.note = r.note as string;
    } else if (r.purchase_per_m2 != null) {
      ov.prices[code.toLowerCase()] = num(r.purchase_per_m2);
    }
  }
  return out;
}

/** Set (or clear, when price is null) a per-line special purchase price. */
export async function setOverridePrice(
  quotationId: string,
  lineCode: string,
  price: number | null,
): Promise<void> {
  const code = lineCode.trim();
  if (!code) throw new Error('setOverridePrice: line code required');
  if (price == null) {
    const { error } = await supabase()
      .from('quotation_overrides')
      .delete()
      .eq('quotation_id', quotationId)
      .eq('line_code', code);
    if (error) throw new Error(`db.setOverridePrice(clear): ${error.message}`);
    return;
  }
  const { error } = await supabase()
    .from('quotation_overrides')
    .upsert(
      { quotation_id: quotationId, line_code: code, purchase_per_m2: price, updated_at: new Date().toISOString() },
      { onConflict: 'quotation_id,line_code' },
    );
  if (error) throw new Error(`db.setOverridePrice: ${error.message}`);
}

/** Set the offerte-level "los verkocht — geen legservice" flag (line_code ''). */
export async function setOverrideNoLabor(
  quotationId: string,
  noLabor: boolean,
  note?: string | null,
): Promise<void> {
  const { error } = await supabase()
    .from('quotation_overrides')
    .upsert(
      { quotation_id: quotationId, line_code: '', no_labor: noLabor, note: note ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'quotation_id,line_code' },
    );
  if (error) throw new Error(`db.setOverrideNoLabor: ${error.message}`);
}

// ── Read all quotations / deals (for date-range aggregation) ────────────
type Row = Record<string, unknown>;

function rowToQuotation(r: Row): QuotationRow {
  const status = r.status as QuotationRow['status'];
  const dateCreated = (r.date_created as string) ?? '';
  const dateAccepted = (r.date_accepted as string) ?? '';
  const relevant = status !== 'open' && dateAccepted ? dateAccepted : dateCreated;
  const { month, quarter, year } = deriveDateParts(relevant);
  const lines = (r.lines as QuotationLine[]) ?? [];
  const totalM2 = num(r.total_m2);
  const omzetVloer = num(r.omzet_vloer);
  return {
    id: r.id as string,
    name: (r.name as string) ?? '',
    dealId: (r.deal_id as string) ?? '',
    customerName: (r.customer_name as string) ?? '',
    city: (r.city as string) ?? '',
    postalCode: (r.postal_code as string) ?? '',
    status,
    dateCreated,
    dateAccepted,
    month,
    quarter,
    year,
    revenueExVat: num(r.revenue_ex_vat),
    revenueInclVat: num(r.revenue_incl_vat),
    omzetVloer,
    totalM2,
    prijsPerM2: totalM2 > 0 ? Math.round((omzetVloer / totalM2) * 100) / 100 : 0,
    cost: numOrNull(r.cost),
    margin: numOrNull(r.margin),
    marginPct: numOrNull(r.margin_pct),
    matchCoverage: numOrNull(r.match_coverage),
    verified: Boolean(r.verified),
    deletedAtSource: Boolean(r.deleted_at_source),
    // Derived from the stored lines rather than a column — the lines JSONB is the
    // single source of truth for what each line's text did (and didn't) say.
    needsReview: lines.some((l) => l.laborRule === 'unknown'),
    products: [...new Set(lines.map((l) => l.code))],
    lines,
  };
}

function rowToDeal(r: Row): RunTimeRow {
  const dateAccepted = (r.date_accepted as string) ?? '';
  const { month, quarter, year } = deriveDateParts(dateAccepted);
  return {
    dealId: r.id as string,
    title: (r.title as string) ?? '',
    dateAccepted,
    dateExecution: (r.date_execution as string) ?? '',
    runTimeDays: num(r.run_time_days),
    leadSource: (r.lead_source as string) ?? '',
    month,
    quarter,
    year,
  };
}

async function readAll(table: string): Promise<Row[]> {
  const out: Row[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase().from(table).select('*').range(from, from + size - 1);
    if (error) throw new Error(`db.readAll(${table}): ${error.message}`);
    const rows = (data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

/**
 * Alle offertes die nog in Teamleader bestaan. Rijen die daar verwijderd zijn
 * blijven in de database staan (historie wissen is niet terug te draaien) maar
 * horen in geen enkele aggregatie thuis — zie markDeletedAtSource.
 */
export async function getAllQuotations(): Promise<QuotationRow[]> {
  return (await readAll('quotations')).map(rowToQuotation).filter((q) => !q.deletedAtSource);
}

/** Inclusief de bij de bron verwijderde offertes — voor beheer/inzicht. */
export async function getAllQuotationsIncludingDeleted(): Promise<QuotationRow[]> {
  return (await readAll('quotations')).map(rowToQuotation);
}

/**
 * Markeer elke opgeslagen offerte die NIET in `liveIds` zit als verwijderd bij de
 * bron, en haal de markering weg bij offertes die weer opduiken. Alleen aan te
 * roepen na een volledige backfill: die heeft het complete beeld. De 90-daagse
 * sync haalt oudere offertes niet op en zou ze dus ten onrechte wegstrepen.
 */
export async function markDeletedAtSource(liveIds: Set<string>): Promise<{
  marked: number;
  restored: number;
  skipped?: string;
}> {
  const probe = await supabase().from('quotations').select('deleted_at_source').limit(1);
  if (probe.error) {
    // Kolom ontbreekt nog — overslaan in plaats van de backfill laten falen.
    // Migratie nog niet gedraaid — overslaan in plaats van de backfill laten falen.
    return {
      marked: 0,
      restored: 0,
      skipped:
        'kolom deleted_at_source bestaat nog niet — draai in de Supabase SQL editor: ' +
        'alter table quotations add column if not exists deleted_at_source boolean default false;',
    };
  }
  const rows = await readAll('quotations');
  const toMark = rows
    .filter((r) => !liveIds.has(r.id as string) && !r.deleted_at_source)
    .map((r) => r.id as string);
  const toRestore = rows
    .filter((r) => liveIds.has(r.id as string) && r.deleted_at_source)
    .map((r) => r.id as string);

  for (const [ids, value] of [
    [toMark, true],
    [toRestore, false],
  ] as const) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      if (chunk.length === 0) continue;
      const { error } = await supabase()
        .from('quotations')
        .update({ deleted_at_source: value })
        .in('id', chunk);
      if (error) throw new Error(`db.markDeletedAtSource: ${error.message}`);
    }
  }
  return { marked: toMark.length, restored: toRestore.length };
}

export async function getAllDeals(): Promise<RunTimeRow[]> {
  return (await readAll('deals')).map(rowToDeal);
}

function rowToInvoice(r: Row): InvoiceRow {
  return {
    id: r.id as string,
    invoiceDate: (r.invoice_date as string) ?? '',
    status: (r.status as string) ?? '',
    paid: Boolean(r.paid),
    totalExcl: num(r.total_excl),
    dueIncl: num(r.due_incl),
    customerId: (r.customer_id as string) ?? '',
    dueOn: (r.due_on as string) ?? '',
    customerName: (r.customer_name as string) ?? '',
    paidAt: (r.paid_at as string) ?? '',
  };
}

export async function upsertInvoices(rows: InvoiceRow[]): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map((inv) => ({
    id: inv.id,
    invoice_date: inv.invoiceDate || null,
    status: inv.status,
    paid: inv.paid,
    total_excl: inv.totalExcl,
    due_incl: inv.dueIncl,
    customer_id: inv.customerId || null,
    due_on: inv.dueOn || null,
    customer_name: inv.customerName || null,
    paid_at: inv.paidAt || null,
    synced_at: new Date().toISOString(),
  }));
  for (let i = 0; i < payload.length; i += 500) {
    const { error } = await supabase().from('invoices').upsert(payload.slice(i, i + 500));
    if (error) throw new Error(`db.upsertInvoices: ${error.message}`);
  }
}

export async function getAllInvoices(): Promise<InvoiceRow[]> {
  return (await readAll('invoices')).map(rowToInvoice);
}

// Re-export the numeric coercers for callers that read raw rows.
export { num as _num, numOrNull as _numOrNull };
