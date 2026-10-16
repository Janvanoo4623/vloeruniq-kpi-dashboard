// Het resultaat per maand: omzet uit Teamleader, kosten uit Moneybird.
//
// Waarom die twee bronnen door elkaar. Moneybird kent pas omzet sinds juli 2026
// (vanaf dan kopieert Combidesk de facturen), maar kosten al sinds februari.
// Alleen Moneybird zou dus maanden met een fors verlies laten zien die er niet
// waren. Teamleader heeft alle facturen sinds november 2024 en komt, waar ze
// overlappen, binnen een paar procent overeen met de omzet in Moneybird — die
// staat er daarom als controle naast.
//
// "Compleet vanaf". De boekhouding in Moneybird is in de loop van 2026 opgezet:
// de inkoop liep van 0,2k in februari op naar een normaal niveau in juni. Een
// maand van vóór die grens telt niet mee in het resultaat; hij staat er wel,
// grijs, zodat zichtbaar is waaróm. De grens is instelbaar op de pagina en staat
// in app_settings (`moneybird_start`).
import { getAdsRows, getAppSetting } from './db';
import { CASHFLOW_EXCLUDE } from './teamleader/invoices';
import { invoicedMargin } from './invoiced-margin';
import { getMoneybirdConfig, getMoneybirdPL, type LedgerAccount } from './moneybird';
import type { InvoiceRow, QuotationRow } from './types';

export const START_KEY = 'moneybird_start';
/** Eerste maand waarin de inkoop in Moneybird op een normaal niveau lag. */
export const DEFAULT_START = '2026-06';

const r2 = (v: number) => Math.round(v * 100) / 100;

export interface ResultMonth {
  month: string; // YYYY-MM
  /** Gefactureerd in Teamleader, ex btw, creditnota's eraf. */
  revenue: number;
  /** Omzet zoals Moneybird hem kent — alleen ter controle. */
  mbRevenue: number;
  directCosts: number;
  expenses: number;
  other: number;
  /** Bedrag per grootboekrekening (id → €). */
  values: Record<string, number>;
  /** Google + Meta volgens de advertentieplatforms. */
  adsCost: number;
  /** Berekende marge (prijslijst) op de facturen van deze maand, als % — null zonder koppeling. */
  calcMarginPct: number | null;
  /** Telt mee: op of na de startmaand. */
  complete: boolean;
  /** De lopende maand: nog niet alles is geboekt. */
  running: boolean;
}

export interface ResultaatData {
  configured: boolean;
  syncedAt: string | null;
  error: string | null;
  administrationName: string | null;
  startMonth: string;
  accounts: LedgerAccount[];
  months: ResultMonth[];
}

/** Gefactureerd per maand (Teamleader), ex btw, creditnota's eraf, NV Vloeren eruit. */
export function invoicedByMonth(invoices: InvoiceRow[]): Map<string, number> {
  const omzet = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.status === 'draft' || !inv.invoiceDate) continue;
    // Intern gefactureerd blijft overal buiten, net als in de cashflow.
    if (CASHFLOW_EXCLUDE.test(inv.customerName)) continue;
    const m = inv.invoiceDate.slice(0, 7);
    omzet.set(m, (omzet.get(m) ?? 0) + inv.totalExcl);
  }
  return omzet;
}

export async function buildResultaat(input: {
  invoices: InvoiceRow[];
  quotations: QuotationRow[]; // al door resolveQuotations heen
  exclusions: Set<string>;
}): Promise<ResultaatData> {
  const [cfg, pl, startMonth] = await Promise.all([
    getMoneybirdConfig().catch(() => null),
    getMoneybirdPL(),
    getAppSetting<string>(START_KEY, DEFAULT_START).catch(() => DEFAULT_START),
  ]);

  const omzet = invoicedByMonth(input.invoices);

  // Maanden waarin er in Moneybird (bijna) niets geboekt was — 2025, vóór de
  // overstap van SnelStart, met één verdwaalde inkoopfactuur van EUR 388 in
  // april — zeggen niets. De grafiek begint bij de eerste maand met noemenswaardige kosten.
  const eerste = pl.months.findIndex((m) => m.revenue > 0 || m.directCosts + m.expenses >= 1000);
  const plMonths = eerste < 0 ? [] : pl.months.slice(eerste);
  const first = plMonths[0]?.month;
  const thisMonth = new Date().toISOString().slice(0, 7);
  const adsRows = first ? ((await getAdsRows(`${first}-01`, `${thisMonth}-31`)) ?? []) : [];
  const ads = new Map<string, number>();
  for (const r of adsRows) ads.set(r.date.slice(0, 7), (ads.get(r.date.slice(0, 7)) ?? 0) + r.cost);

  const months: ResultMonth[] = plMonths.map((m) => {
    const lastDay = new Date(Date.UTC(Number(m.month.slice(0, 4)), Number(m.month.slice(5, 7)), 0)).toISOString().slice(0, 10);
    const im = invoicedMargin(input.invoices, input.quotations, input.exclusions, `${m.month}-01`, lastDay);
    return {
      month: m.month,
      revenue: r2(omzet.get(m.month) ?? 0),
      mbRevenue: m.revenue,
      directCosts: m.directCosts,
      expenses: m.expenses,
      other: m.other,
      values: m.values,
      adsCost: r2(ads.get(m.month) ?? 0),
      calcMarginPct: im.linked ? im.marginPct : null,
      complete: m.month >= startMonth,
      running: m.month === thisMonth,
    };
  });

  return {
    configured: cfg != null,
    syncedAt: pl.syncedAt,
    error: pl.error,
    administrationName: pl.administrationName,
    startMonth,
    accounts: pl.accounts,
    months,
  };
}
