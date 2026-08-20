// Klantanalyses op de factuurkant: concentratie, betaalgedrag per klant, en
// facturatie die niet uit een offerte komt.
//
// Eén ding vooraf over de sleutel. Facturen hebben zowel `customerId` als
// `customerName`; offertes alleen een naam. Voor alles wat binnen de facturen
// blijft gebruiken we het id (426 namen tegenover 430 id's — namen bevatten
// dubbele spaties en schrijfvarianten). Zodra we facturen aan offertes moeten
// koppelen kan het niet anders dan op naam, en dan is de match per definitie
// benaderend. Dat staat overal waar het speelt expliciet in de uitkomst.
import type { InvoiceRow, QuotationRow } from './types';

const DAY = 86400000;
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Normaliseer een klantnaam voor het koppelen van facturen aan offertes. */
export function normaliseCustomer(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLocaleLowerCase('nl');
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10;
}

// ── 1. Klantconcentratie ─────────────────────────────────────────────────

export interface CustomerStat {
  id: string;
  name: string;
  revenue: number; // gefactureerd ex btw
  invoices: number;
  firstInvoice: string;
  lastInvoice: string;
  /** Gemiddelde betaaltermijn in dagen; null bij te weinig betaalde facturen. */
  avgDaysToPay: number | null;
  paidOnTime: number;
  paidTotal: number;
  /** Cumulatief aandeel van de omzet t/m deze klant (voor de Pareto-curve). */
  cumulativeShare: number;
}

export interface CustomerConcentration {
  customers: CustomerStat[];
  totalRevenue: number;
  /** Hoeveel klanten samen de helft van de omzet zijn. */
  customersForHalf: number;
  /** Aandeel van de tien grootste klanten. */
  top10Share: number;
  /** Klanten met meer dan één factuur. */
  repeatCustomers: number;
}

/**
 * Hoe afhankelijk ben je van een handvol klanten? Gebaseerd op facturen, niet op
 * offertes: een offerte kan verlopen, een factuur is echt geld.
 */
export function customerConcentration(invoices: InvoiceRow[]): CustomerConcentration {
  const per = new Map<
    string,
    { name: string; revenue: number; invoices: number; first: string; last: string; lags: number[]; onTime: number; paid: number }
  >();

  for (const inv of invoices) {
    // Concepten zijn nog geen omzet.
    if (inv.status === 'draft') continue;
    const key = inv.customerId || normaliseCustomer(inv.customerName || '') || inv.id;
    const e =
      per.get(key) ??
      { name: inv.customerName || '—', revenue: 0, invoices: 0, first: inv.invoiceDate, last: inv.invoiceDate, lags: [], onTime: 0, paid: 0 };
    e.revenue += inv.totalExcl;
    e.invoices += 1;
    if (inv.invoiceDate && inv.invoiceDate < e.first) e.first = inv.invoiceDate;
    if (inv.invoiceDate && inv.invoiceDate > e.last) e.last = inv.invoiceDate;
    if (inv.paid && inv.paidAt && inv.invoiceDate) {
      const dagen = Math.max(0, Math.floor((Date.parse(inv.paidAt) - Date.parse(inv.invoiceDate)) / DAY));
      e.lags.push(dagen);
      e.paid += 1;
      if (inv.dueOn && inv.paidAt <= inv.dueOn) e.onTime += 1;
    }
    if (!e.name || e.name === '—') e.name = inv.customerName || e.name;
    per.set(key, e);
  }

  const gesorteerd = [...per.entries()]
    .map(([id, e]) => ({
      id,
      name: e.name,
      revenue: Math.round(e.revenue),
      invoices: e.invoices,
      firstInvoice: e.first,
      lastInvoice: e.last,
      // Onder drie betaalde facturen zegt een gemiddelde termijn niets.
      avgDaysToPay: e.lags.length >= 3 ? round1(e.lags.reduce((s, v) => s + v, 0) / e.lags.length) : null,
      paidOnTime: e.onTime,
      paidTotal: e.paid,
      cumulativeShare: 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const totaal = gesorteerd.reduce((s, c) => s + c.revenue, 0);
  let loper = 0;
  let voorHelft = 0;
  for (const [i, c] of gesorteerd.entries()) {
    loper += c.revenue;
    c.cumulativeShare = totaal > 0 ? round1((loper / totaal) * 100) : 0;
    if (voorHelft === 0 && c.cumulativeShare >= 50) voorHelft = i + 1;
  }

  return {
    customers: gesorteerd,
    totalRevenue: totaal,
    customersForHalf: voorHelft,
    top10Share:
      totaal > 0 ? round1((gesorteerd.slice(0, 10).reduce((s, c) => s + c.revenue, 0) / totaal) * 100) : 0,
    repeatCustomers: gesorteerd.filter((c) => c.invoices > 1).length,
  };
}

// ── 2. Betaalgedrag: verdeling en trage betalers ─────────────────────────

export interface PaymentDistribution {
  buckets: { label: string; count: number; share: number }[];
  medianDays: number | null;
  p90Days: number | null;
  sample: number;
  onTimePct: number | null;
  /** Klanten met minstens 3 betaalde facturen, traagste eerst. */
  slowest: CustomerStat[];
}

const PAY_BUCKETS: { label: string; max: number }[] = [
  { label: 'Direct (0 d)', max: 1 },
  { label: '1–14 d', max: 15 },
  { label: '15–30 d', max: 31 },
  { label: '31–60 d', max: 61 },
  { label: '60+ d', max: Infinity },
];

/**
 * De verdeling, niet het gemiddelde. Die twee vertellen hier een tegengesteld
 * verhaal: de mediaan is een paar dagen terwijl maar de helft op tijd betaalt.
 * Dat komt doordat de verdeling bimodaal is — particulieren rekenen vrijwel
 * meteen af, zakelijke klanten laten het lopen. Eén gemiddelde verstopt dat, en
 * één uitschieter van meer dan een jaar vernielt het bovendien.
 */
export function paymentDistribution(
  invoices: InvoiceRow[],
  concentration: CustomerConcentration,
): PaymentDistribution {
  const dagen: number[] = [];
  let opTijd = 0;
  let metVervaldatum = 0;

  for (const inv of invoices) {
    if (inv.status === 'draft' || !inv.paid || !inv.paidAt || !inv.invoiceDate) continue;
    dagen.push(Math.max(0, Math.floor((Date.parse(inv.paidAt) - Date.parse(inv.invoiceDate)) / DAY)));
    if (inv.dueOn) {
      metVervaldatum += 1;
      if (inv.paidAt <= inv.dueOn) opTijd += 1;
    }
  }

  const buckets = PAY_BUCKETS.map((b) => ({ label: b.label, count: 0, share: 0 }));
  for (const d of dagen) {
    const i = PAY_BUCKETS.findIndex((b) => d < b.max);
    buckets[i < 0 ? buckets.length - 1 : i].count += 1;
  }
  for (const b of buckets) b.share = dagen.length > 0 ? round1((b.count / dagen.length) * 100) : 0;

  const gesorteerd = [...dagen].sort((a, b) => a - b);
  return {
    buckets,
    medianDays: median(dagen),
    p90Days: gesorteerd.length > 0 ? gesorteerd[Math.min(gesorteerd.length - 1, Math.floor(gesorteerd.length * 0.9))] : null,
    sample: dagen.length,
    onTimePct: metVervaldatum > 0 ? round1((opTijd / metVervaldatum) * 100) : null,
    slowest: concentration.customers
      .filter((c) => c.avgDaysToPay != null)
      .sort((a, b) => (b.avgDaysToPay ?? 0) - (a.avgDaysToPay ?? 0))
      .slice(0, 10),
  };
}

// ── 3. Facturen zonder offerte ───────────────────────────────────────────

export interface UnquotedInvoicing {
  /** Facturen waarvan de klantnaam bij geen enkele offerte voorkomt. */
  count: number;
  revenue: number;
  totalCount: number;
  totalRevenue: number;
  share: number;
  /** Grootste klanten zonder offerte, grootste bedrag eerst. */
  customers: { name: string; revenue: number; invoices: number }[];
}

/**
 * Welk deel van de facturatie komt niet uit het offertetraject? Dat is werk dat
 * buiten elke marge-, conversie- en pijplijnberekening valt.
 *
 * De koppeling kan alleen op klantnaam — er is geen verwijzing van factuur naar
 * offerte. Een deel hiervan is dus een naam die net anders is geschreven, niet
 * per se werk zonder offerte. Behandel het als een bovengrens en een werklijst,
 * niet als een exact bedrag.
 */
export function unquotedInvoicing(
  invoices: InvoiceRow[],
  quotations: QuotationRow[],
): UnquotedInvoicing {
  const offerteKlanten = new Set(
    quotations.map((q) => normaliseCustomer(q.customerName || '')).filter(Boolean),
  );

  const per = new Map<string, { name: string; revenue: number; invoices: number }>();
  let count = 0;
  let revenue = 0;
  let totalCount = 0;
  let totalRevenue = 0;

  for (const inv of invoices) {
    if (inv.status === 'draft') continue;
    totalCount += 1;
    totalRevenue += inv.totalExcl;
    const naam = normaliseCustomer(inv.customerName || '');
    if (!naam || offerteKlanten.has(naam)) continue;
    count += 1;
    revenue += inv.totalExcl;
    const e = per.get(naam) ?? { name: inv.customerName || '—', revenue: 0, invoices: 0 };
    e.revenue += inv.totalExcl;
    e.invoices += 1;
    per.set(naam, e);
  }

  return {
    count,
    revenue: Math.round(revenue),
    totalCount,
    totalRevenue: Math.round(totalRevenue),
    share: totalRevenue > 0 ? round1((revenue / totalRevenue) * 100) : 0,
    customers: [...per.values()]
      .map((c) => ({ ...c, revenue: Math.round(c.revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20),
  };
}

// ── 4. Geoffreerd versus gefactureerd ────────────────────────────────────

export interface QuotedVsInvoicedPoint {
  month: string; // YYYY-MM
  accepted: number; // geaccepteerde offertewaarde, ex btw
  invoiced: number; // gefactureerd, ex btw
}

export interface QuotedVsInvoiced {
  points: QuotedVsInvoicedPoint[];
  /** Mediane dagen van acceptatie tot de eerste factuur op dezelfde klantnaam. */
  medianDaysToInvoice: number | null;
  p90DaysToInvoice: number | null;
  /** Op hoeveel geaccepteerde offertes die doorlooptijd steunt. */
  matched: number;
  acceptedTotal: number;
}

/**
 * Zet ik getekende offertes ook echt om in facturen, en hoe lang duurt dat?
 *
 * De twee lijnen lopen structureel uiteen en dat is geen fout: er wordt ook
 * gefactureerd zonder offerte (zie unquotedInvoicing). Ze staan hier naast
 * elkaar om het ritme te vergelijken, niet om te salderen.
 */
export function quotedVsInvoiced(
  quotations: QuotationRow[],
  invoices: InvoiceRow[],
): QuotedVsInvoiced {
  const perMaand = new Map<string, QuotedVsInvoicedPoint>();
  const punt = (m: string) => {
    const p = perMaand.get(m) ?? { month: m, accepted: 0, invoiced: 0 };
    perMaand.set(m, p);
    return p;
  };

  for (const q of quotations) {
    if (q.status !== 'accepted') continue;
    const d = q.dateAccepted || q.dateCreated;
    if (d) punt(d.substring(0, 7)).accepted += q.revenueExVat;
  }
  for (const inv of invoices) {
    if (inv.status === 'draft' || !inv.invoiceDate) continue;
    punt(inv.invoiceDate.substring(0, 7)).invoiced += inv.totalExcl;
  }

  // Doorlooptijd offerte -> eerste factuur, gekoppeld op klantnaam. Alleen de
  // eerste factuur ná de acceptatiedatum telt; eerdere facturen horen bij ander
  // werk voor dezelfde klant.
  const factuurPerKlant = new Map<string, string[]>();
  for (const inv of invoices) {
    if (inv.status === 'draft' || !inv.invoiceDate) continue;
    const naam = normaliseCustomer(inv.customerName || '');
    if (!naam) continue;
    const lijst = factuurPerKlant.get(naam) ?? [];
    lijst.push(inv.invoiceDate);
    factuurPerKlant.set(naam, lijst);
  }
  for (const lijst of factuurPerKlant.values()) lijst.sort();

  const lags: number[] = [];
  let acceptedTotal = 0;
  for (const q of quotations) {
    if (q.status !== 'accepted' || !q.dateAccepted) continue;
    acceptedTotal += 1;
    const naam = normaliseCustomer(q.customerName || '');
    const eerste = factuurPerKlant.get(naam)?.find((d) => d >= q.dateAccepted);
    if (!eerste) continue;
    lags.push(Math.floor((Date.parse(eerste) - Date.parse(q.dateAccepted)) / DAY));
  }
  const gesorteerd = [...lags].sort((a, b) => a - b);

  return {
    points: [...perMaand.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((p) => ({ ...p, accepted: Math.round(p.accepted), invoiced: Math.round(p.invoiced) })),
    medianDaysToInvoice: median(lags),
    p90DaysToInvoice: gesorteerd.length > 0 ? gesorteerd[Math.min(gesorteerd.length - 1, Math.floor(gesorteerd.length * 0.9))] : null,
    matched: lags.length,
    acceptedTotal,
  };
}
