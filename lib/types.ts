// Shared types for the Vloeruniq KPI dashboard.
// See docs/DATA-MODEL.md for the meaning of each field.

/**
 * Teamleader kent ook 'expired'. Die haalden we eerst niet op, waardoor een
 * verlopen offerte uit accepted/open/refused viel en bij ons eeuwig op 'open'
 * bleef staan — 23 spookoffertes in de pijplijn. Verlopen telt nu als verloren,
 * maar blijft apart zichtbaar van 'geweigerd': stilletjes verlopen vraagt een
 * andere actie dan een klant die nee zegt.
 */
export type QuotationStatus = 'accepted' | 'open' | 'refused' | 'expired';

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
  /** Beslisdatum: geaccepteerd, geweigerd óf verlopen. Leeg zolang nog open. */
  dateAccepted: string; // YYYY-MM-DD or ''
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
  /**
   * Staat niet meer in Teamleader (bron geeft 404). We bewaren de rij — historie
   * stil laten verdampen is niet terug te draaien — maar houden hem overal uit
   * de aggregaties. Alleen een volledige backfill kan dit vaststellen; de
   * 90-daagse sync ziet oudere offertes niet en mag er dus niets uit afleiden.
   */
  deletedAtSource?: boolean;
  needsReview?: boolean; // >=1 floor line whose text doesn't say if leggen is included
  products: string[]; // matched floor products (P-numbers / names), distinct, in order
  lines?: QuotationLine[]; // per-product line stats (populated at sync time, stored in DB)
}

/**
 * How the floor is fixed to the sub-floor — drives the underlay surcharge.
 * A line carries at most one: glued (primer+lijm+egaline), self-adhesive
 * (zelfklevende ondervloer), or click (underlay is part of the plank, €0).
 */
export type InstallMode = 'glued' | 'selfadhesive' | 'click';

/**
 * Whether the line includes installation (legservice), derived from its text.
 * `unknown` = the description says nothing either way; labour is still charged
 * but the quotation is flagged for review rather than silently guessed.
 */
export type LaborRule = 'included' | 'excluded' | 'unknown';

/** One matched floor line's stats (for top-products aggregation + DB storage). */
export interface QuotationLine {
  code: string;
  revenue: number;
  m2: number;
  margin: number | null;
  desc?: string; // raw line description (for modal transparency; populated at sync time)
  // Cost components (€/m²) resolved at sync time, so per-quotation corrections
  // (special purchase price / no-labour) can be recomputed instantly at read
  // time. Absent on rows synced before this was added — the override recompute
  // falls back to the default constant rates. See lib/overrides.ts.
  purchasePerM2?: number; // matched purchase price (absent = unpriced line)
  underlayPerM2?: number; // glued or self-adhesive surcharge (0 for click)
  gluedPerM2?: number; // legacy name for underlayPerM2 (rows synced before 2026-08)
  laborPerM2?: number; // labour + custom per-m² costs (0 when installation is excluded)
  installMode?: InstallMode;
  laborRule?: LaborRule;
  /** `code` is uit de omschrijving afgeleid omdat niets in de prijslijst matchte. */
  derivedCode?: boolean;
}

/**
 * A per-quotation manual correction (feedback 2026-07-13). Applied at read time.
 * - prices: per-line-code special purchase price €/m² (only that quotation).
 * - noLabor: floor sold loose, drop the labour cost for this quotation.
 */
export interface QuotationOverride {
  noLabor: boolean;
  prices: Record<string, number>; // line code (lowercased) -> purchase €/m²
  note?: string;
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
  expiredRevenue: number;
  acceptedCount: number;
  openCount: number;
  refusedCount: number;
  expiredCount: number;
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
  expiredRevenue: number;
  acceptedCount: number;
  openCount: number;
  refusedCount: number;
  expiredCount: number;
  /** Geaccepteerd / (geaccepteerd + geweigerd + verlopen). Verlopen telt als verloren. */
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

/** Enriched lead-source stats (accepted revenue + margin + deal size + run time). */
export interface LeadSourceStat extends LeadSource {
  marginPct: number | null;
  avgDealSize: number;
  avgRunTimeDays: number | null;
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

/** One invoice (stored in Supabase, for period-filterable invoicing + aging). */
export interface InvoiceRow {
  id: string;
  invoiceDate: string; // YYYY-MM-DD
  status: string; // draft | booked | ...
  paid: boolean;
  totalExcl: number;
  dueIncl: number;
  customerId: string;
  dueOn: string; // due date YYYY-MM-DD ('' if none)
  customerName: string;
  paidAt: string; // payment date YYYY-MM-DD ('' if unpaid / unknown)
}

/** One outstanding invoice within an aging bucket (drives the drill-down modal). */
export interface AgingInvoice {
  id: string;
  customerName: string;
  invoiceDate: string;
  dueOn: string;
  amount: number; // due incl VAT
  daysOverdue: number;
  vloer: string | null; // matched floor product(s) from the customer's quotation
  m2: number | null; // matched quotation m²
}

/** Outstanding invoices bucketed by age relative to the due date. */
export interface AgingBucket {
  label: string;
  amount: number; // incl VAT
  count: number;
  invoices: AgingInvoice[];
}

export interface OverdueInvoice {
  id: string;
  customerName: string;
  invoiceDate: string;
  dueOn: string;
  amount: number; // due incl VAT
  daysOverdue: number;
  quotation: QuotationRow | null; // matched quotation (drives the drill-down modal)
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
  leadSources: LeadSourceStat[];
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
