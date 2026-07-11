// Shared types for the Vloeruniq KPI dashboard.
// See docs/DATA-MODEL.md for the meaning of each field.

export type QuotationStatus = 'accepted' | 'open' | 'refused';

/** One row of the Revenue table (per quotation). */
export interface QuotationRow {
  id: string;
  name: string;
  dealId: string;
  customerName: string;
  city: string; // customer city (for geographic insights)
  postalCode: string;
  status: QuotationStatus;
  dateCreated: string; // YYYY-MM-DD
  dateAccepted: string; // YYYY-MM-DD or '' (also used for refused date)
  month: string; // YYYY-MM
  quarter: string; // e.g. "Q2 2026"
  year: string;
  revenueExVat: number;
  revenueInclVat: number;
  omzetVloer: number; // floor-only revenue ex VAT
  totalM2: number;
  prijsPerM2: number;
  cost: number | null; // material + labour for matched m²
  margin: number | null; // omzetVloer - cost
  marginPct: number | null;
  matchCoverage: number | null; // % of m² that matched a price
  verified: boolean; // 100% coverage and margin present
  products: string[]; // matched floor products (P-numbers / names), distinct, in order
  lines?: QuotationLine[]; // per-product line stats (populated at sync time, stored in DB)
}

/** One matched floor line's stats (for top-products aggregation + DB storage). */
export interface QuotationLine {
  code: string;
  revenue: number;
  m2: number;
  margin: number | null;
}

/** One row of the Run Time table (per won deal). */
export interface RunTimeRow {
  dealId: string;
  title: string;
  dateAccepted: string; // closed_at date, YYYY-MM-DD
  dateExecution: string; // YYYY-MM-DD
  runTimeDays: number;
  leadSource: string; // joined with ", "
  month: string;
  quarter: string;
  year: string;
}

export interface WeekRevenue {
  acceptedRevenue: number;
  openRevenue: number;
  refusedRevenue: number;
  acceptedCount: number;
  openCount: number;
  refusedCount: number;
  acceptedM2: number;
  acceptedMargin: number; // sum of per-quotation margin (only those with a margin)
  acceptedMarginRev: number; // matching revenue base for avg margin %
}

export interface WeekRunTime {
  totalDays: number;
  count: number;
}

export interface RevenueTotals {
  acceptedRevenue: number;
  openRevenue: number;
  refusedRevenue: number;
  acceptedCount: number;
  openCount: number;
  refusedCount: number;
  conversionPct: number;
  avgRevenuePerDeal: number;
  m2Sold: number;
  totalMargin: number;
  avgMarginPct: number;
}

export interface LeadSource {
  name: string;
  revenue: number;
  count: number;
}

/** Revenue per region (customer city). */
export interface RegionStat {
  name: string; // city
  revenue: number;
  count: number;
}

/** Aggregated stats per floor product (P-number / name). */
export interface ProductStat {
  code: string;
  revenue: number; // floor revenue ex VAT
  m2: number;
  margin: number | null; // sum of line margins where priced
  marginPct: number | null;
  count: number; // # accepted quotations containing this product
}

/** Quoted vs invoiced summary over the period. */
export interface InvoicingSummary {
  invoicedExcl: number; // booked (non-draft) invoices, ex VAT
  paidExcl: number; // paid invoices, ex VAT
  outstandingIncl: number; // unpaid booked invoices, amount due (incl VAT)
  invoiceCount: number;
  paidCount: number;
  openCount: number;
}

/** One invoice (stored in Supabase, for period-filterable invoicing). */
export interface InvoiceRow {
  id: string;
  invoiceDate: string; // YYYY-MM-DD
  status: string; // draft | booked | ...
  paid: boolean;
  totalExcl: number;
  dueIncl: number;
  customerId: string;
}

/** Customer info from the deals.list side-load (name + address). */
export interface CustomerInfo {
  name: string;
  city: string;
  postalCode: string;
  country: string;
}

/** The single computed object the dashboard reads. */
export interface Snapshot {
  generatedAt: string; // ISO timestamp
  lookbackDays: number;
  weeks: string[]; // ISO week labels, descending (e.g. "2026-W25")
  revenue: {
    totals: RevenueTotals;
    byWeek: Record<string, WeekRevenue>;
  };
  runTime: {
    totals: { avgRunTimeDays: number; dealsTracked: number };
    byWeek: Record<string, WeekRunTime>;
  };
  leadSources: LeadSource[];
  regions: RegionStat[];
  topProducts: ProductStat[];
  invoicing: InvoicingSummary;
  quotations: QuotationRow[];
  /** Per-deal run-time rows; powers change-detection for write-back + a future table. */
  runTimeRows: RunTimeRow[];
}

export type SyncStatus = 'idle' | 'running' | 'ok' | 'error';

export interface SyncMeta {
  status: SyncStatus;
  startedAt: string | null;
  lastSyncAt: string | null;
  durationMs: number | null;
  counts: {
    quotations: number;
    runTime: number;
    pushedToTeamleader: number;
  } | null;
  error: string | null;
}

/** Rotating Teamleader OAuth token state (lives in the datastore). */
export interface TokenState {
  refreshToken: string;
  accessToken?: string;
  accessTokenExpiresAt?: number; // epoch ms
}

/** One editable price-map entry (Config-tab equivalent). */
export interface PriceMapEntry {
  match: string; // "P620" or "VT Wonen Herringbone"
  price: number; // purchase price ex VAT per m²
}
