// Server-only: alles wat van de gekozen periode afhangt, in één functie.
// Gebruikt door de layout (eerste weergave) én /api/data (periodekiezer), zodat
// die twee nooit een ander getal geven. Bevat sinds 2026-09-17 ook:
//  - `previous`: altijd de even lange periode ervoor, voor de pijltjes op
//    Overzicht (30 dagen tegenover de 30 dagen ervoor, ongeacht de keuze in de
//    periodekiezer);
//  - `adsDaily`: dagtotalen Google Ads, voor de KPI-grafiek op Overzicht;
//  - `openStock`: de openstaande stapel per week, voor Trends.
import { getAdsRows } from './db';
import { summarizeInvoices } from './teamleader/invoices';
import { snapshotForRange } from './range';
import { perM2Stats, type PerM2Stats } from './insights';
import { customerAnalysis, type CustomerAnalysis } from './customers';
import { openStockSeries, type OpenStockPoint } from './open-stock';
import { comparisonRange } from './ads-payload';
import type { AdsDayPoint } from './kpi-series';
import type { InvoiceRow, InvoicingSummary, QuotationRow, RevenueTotals, RunTimeRow, Snapshot } from './types';

export interface PeriodComparison {
  from: string;
  to: string;
  revenue: RevenueTotals;
  runTime: { avgRunTimeDays: number; dealsTracked: number };
  invoicing: InvoicingSummary;
  perM2: PerM2Stats;
  /** De openstaande stapel aan het eind van de periode: alles wat toen open stond, ook van vóór de periode. */
  openAtEnd: { count: number; value: number };
  /** Advertentiekosten in die periode, per platform. */
  adsCost: { google: number; meta: number };
}

export interface PeriodData {
  range: { from: string; to: string };
  snapshot: Snapshot;
  /** De gekozen vergelijking (vorige periode of vorig jaar), of null. */
  comparison: PeriodComparison | null;
  /** Altijd: de even lange periode direct ervoor. */
  previous: PeriodComparison;
  /** Openstaande stapel aan het eind van déze periode — de tegenhanger van previous.openAtEnd. */
  openAtEnd: { count: number; value: number };
  customers: CustomerAnalysis;
  adsDaily: AdsDayPoint[];
  openStock: OpenStockPoint[];
}

const EMPTY_INVOICING: InvoicingSummary = {
  invoicedExcl: 0,
  paidExcl: 0,
  outstandingIncl: 0,
  invoiceCount: 0,
  paidCount: 0,
  openCount: 0,
};

const invoicingFor = (invoices: InvoiceRow[], from: string, to: string): InvoicingSummary =>
  summarizeInvoices(invoices.filter((inv) => inv.invoiceDate >= from && inv.invoiceDate <= to));

export async function buildPeriodData(input: {
  quotations: QuotationRow[]; // al door resolveQuotations heen
  deals: RunTimeRow[];
  invoices: InvoiceRow[];
  exclusions: Set<string>;
  from: string;
  to: string;
  compare: string; // none | previous | year
}): Promise<PeriodData> {
  const { quotations, deals, invoices, exclusions, from, to, compare } = input;
  const generatedAt = new Date().toISOString();

  const snapshot = snapshotForRange(quotations, deals, from, to, exclusions, invoicingFor(invoices, from, to), generatedAt);

  // Uitsluitingen blijven overal buiten, ook uit de stapel.
  const included = quotations.filter((q) => !exclusions.has(q.id));
  // 'Open' is een momentopname, geen periodecijfer: wat in de vorige periode
  // open stond is nu beslist, dus 'open in periode' vergelijken geeft altijd
  // nul. Daarom vergelijken we de stapel aan het eind van beide periodes.
  const openAt = (date: string) => {
    const p = openStockSeries(included, date, date)[0];
    return { count: p?.count ?? 0, value: p?.value ?? 0 };
  };

  const adsCostIn = async (r: { from: string; to: string }) => {
    const rows = (await getAdsRows(r.from, r.to)) ?? [];
    const sum = (p: string) => Math.round(rows.filter((x) => x.platform === p).reduce((t, x) => t + x.cost, 0) * 100) / 100;
    return { google: sum('google'), meta: sum('meta') };
  };

  const periodFor = async (r: { from: string; to: string }): Promise<PeriodComparison> => {
    const s = snapshotForRange(quotations, deals, r.from, r.to, exclusions, EMPTY_INVOICING, generatedAt);
    return {
      from: r.from,
      to: r.to,
      revenue: s.revenue.totals,
      runTime: s.runTime.totals,
      invoicing: invoicingFor(invoices, r.from, r.to),
      // Per-m²-cijfers komen uit de vloerregels, dus die kan de client niet uit
      // de totalen afleiden — ze gaan mee zodat de vergelijking klopt.
      perM2: perM2Stats(s.quotations),
      openAtEnd: openAt(r.to),
      adsCost: await adsCostIn(r),
    };
  };

  const prevRange = comparisonRange(from, to, 'previous')!;
  const previous = await periodFor(prevRange);
  const cmpRange = comparisonRange(from, to, compare);
  const comparison = cmpRange ? (compare === 'previous' ? previous : await periodFor(cmpRange)) : null;

  // Advertenties: dagtotalen per platform. Tabel nog niet gemigreerd → leeg.
  const adsRows = (await getAdsRows(from, to)) ?? [];
  const byDay = new Map<string, AdsDayPoint>();
  for (const r of adsRows) {
    const e =
      byDay.get(r.date) ??
      { date: r.date, cost: 0, clicks: 0, impressions: 0, conversions: 0, metaCost: 0, metaClicks: 0, metaConversions: 0 };
    if (r.platform === 'meta') {
      e.metaCost += r.cost;
      e.metaClicks += r.clicks;
      e.metaConversions += r.conversions;
    } else {
      e.cost += r.cost;
      e.clicks += r.clicks;
      e.impressions += r.impressions;
      e.conversions += r.conversions;
    }
    byDay.set(r.date, e);
  }
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const adsDaily = [...byDay.values()]
    .map((d) => ({ ...d, cost: r2(d.cost), conversions: r2(d.conversions), metaCost: r2(d.metaCost), metaConversions: r2(d.metaConversions) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // De stapel kijkt naar álle offertes (ook van vóór de periode).
  const openStock = openStockSeries(included, from, to);

  return {
    range: { from, to },
    snapshot,
    comparison,
    previous,
    openAtEnd: openAt(to),
    customers: customerAnalysis(invoices, quotations, from, to),
    adsDaily,
    openStock,
  };
}
