// Google Ads: de rekenregels achter het tabblad Marketing. Pure functies —
// geen database, geen netwerk — zodat de pagina, /api/ads en het exportrapport
// gegarandeerd hetzelfde getal laten zien.
//
// Wat hier NIET gebeurt: attributie. Google Ads meldt "conversies" (formulier,
// telefoontje), Teamleader kent de leadbron "Google" op een gewonnen deal. Dat
// zijn twee verschillende tellingen en we doen niet alsof ze hetzelfde zijn:
// de kosten komen van Google, de omzet en de marge uit Teamleader, en de
// koppeling is de leadbron. Zie docs/DATA-MODEL.md "Marketing".
import { getISOWeek } from './teamleader/dates';
import type { LeadSourceStat, QuotationRow, RunTimeRow } from './types';

export interface AdsDailyRow {
  date: string; // YYYY-MM-DD
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  channel: string;
  impressions: number;
  clicks: number;
  cost: number; // €
  /** 'Alle conversies' van Google (metrics.all_conversions), niet alleen de hoofdconversies. */
  conversions: number;
  conversionValue: number;
}

export interface AdsTotals {
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
  conversionValue: number;
  /** Klikken / vertoningen, in procenten. Null zonder vertoningen. */
  ctr: number | null;
  /** Kosten per klik. Null zonder klikken. */
  cpc: number | null;
  /** Kosten per (alle) conversie. Null zonder conversies. */
  cpa: number | null;
  /** Dagen met tenminste één vertoning — zegt of een periode wel gevuld is. */
  activeDays: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const pct1 = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);
const ratio2 = (num: number, den: number) => (den > 0 ? round2(num / den) : null);

export function adsTotals(rows: AdsDailyRow[]): AdsTotals {
  let cost = 0;
  let clicks = 0;
  let impressions = 0;
  let conversions = 0;
  let conversionValue = 0;
  const days = new Set<string>();
  for (const r of rows) {
    cost += r.cost;
    clicks += r.clicks;
    impressions += r.impressions;
    conversions += r.conversions;
    conversionValue += r.conversionValue;
    if (r.impressions > 0) days.add(r.date);
  }
  return {
    cost: round2(cost),
    clicks,
    impressions,
    conversions: round2(conversions),
    conversionValue: round2(conversionValue),
    ctr: pct1(clicks, impressions),
    cpc: ratio2(cost, clicks),
    cpa: ratio2(cost, conversions),
    activeDays: days.size,
  };
}

// ── Per week ─────────────────────────────────────────────────────────────
export interface AdsWeekPoint {
  week: string; // "2026-W37"
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
}

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().split('T')[0];

/**
 * Weekreeks over de héle periode, ook voor weken zonder uitgaven. Een gat in de
 * grafiek betekent dan "geen advertenties", niet "geen data".
 */
export function adsByWeek(rows: AdsDailyRow[], from: string, to: string): AdsWeekPoint[] {
  const byWeek = new Map<string, AdsWeekPoint>();
  const start = Date.parse(from);
  const end = Date.parse(to);
  // Meer dan ~3 jaar aan dagen zou 'alles' zijn; dan is per week toch te fijn.
  if (Number.isFinite(start) && Number.isFinite(end) && end - start < 1200 * DAY) {
    for (let t = start; t <= end; t += DAY) {
      const w = getISOWeek(iso(t));
      if (!byWeek.has(w)) byWeek.set(w, { week: w, cost: 0, clicks: 0, impressions: 0, conversions: 0 });
    }
  }
  for (const r of rows) {
    const w = getISOWeek(r.date);
    const p = byWeek.get(w) ?? { week: w, cost: 0, clicks: 0, impressions: 0, conversions: 0 };
    p.cost += r.cost;
    p.clicks += r.clicks;
    p.impressions += r.impressions;
    p.conversions += r.conversions;
    byWeek.set(w, p);
  }
  return [...byWeek.values()]
    .map((p) => ({ ...p, cost: round2(p.cost), conversions: round2(p.conversions) }))
    .sort((a, b) => {
      const [ya, wa] = a.week.split('-W').map(Number);
      const [yb, wb] = b.week.split('-W').map(Number);
      return ya !== yb ? ya - yb : wa - wb;
    });
}

// ── Per campagne ─────────────────────────────────────────────────────────
export interface AdsCampaignStat extends AdsTotals {
  id: string;
  name: string;
  status: string;
  channel: string;
  /** Aandeel in de totale kosten van de periode, in procenten. */
  costShare: number | null;
}

export function adsByCampaign(rows: AdsDailyRow[]): AdsCampaignStat[] {
  const groups = new Map<string, AdsDailyRow[]>();
  for (const r of rows) {
    const g = groups.get(r.campaignId) ?? [];
    g.push(r);
    groups.set(r.campaignId, g);
  }
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  return [...groups.entries()]
    .map(([id, g]) => {
      // De naam en status van de nieuwste dag: een campagne kan hernoemd of
      // gepauzeerd zijn, en dan wil je weten hoe hij nú heet.
      const latest = g.reduce((a, b) => (a.date >= b.date ? a : b));
      const t = adsTotals(g);
      return {
        ...t,
        id,
        name: latest.campaignName,
        status: latest.campaignStatus,
        channel: latest.channel,
        costShare: pct1(t.cost, totalCost),
      };
    })
    .filter((c) => c.cost > 0 || c.impressions > 0)
    .sort((a, b) => b.cost - a.cost);
}

// ── Budget per maand ─────────────────────────────────────────────────────
/** 'YYYY-MM' → € per maand; 'default' geldt voor elke maand zonder eigen bedrag. */
export type AdsBudgets = Record<string, number>;

export function parseAdsBudgets(raw: unknown): AdsBudgets {
  const out: AdsBudgets = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!(k === 'default' || /^\d{4}-(0[1-9]|1[0-2])$/.test(k))) continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) out[k] = n;
  }
  return out;
}

export function budgetForMonth(budgets: AdsBudgets, month: string): number | null {
  return budgets[month] ?? budgets.default ?? null;
}

export interface MonthBudgetStatus {
  month: string; // 'YYYY-MM'
  label: string; // 'sep 2026'
  budget: number | null;
  /** Staat het bedrag specifiek voor deze maand, of komt het van de standaard? */
  budgetIsDefault: boolean;
  spent: number;
  pct: number | null;
  /** Alleen voor de lopende maand: uitgaven doorgetrokken naar het maandeinde. */
  projected: number | null;
  daysElapsed: number;
  daysInMonth: number;
  isCurrent: boolean;
  signal: 'good' | 'warn' | 'crit' | null;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' });
}

/** Alle maanden van `from` t/m `to`, oplopend. */
export function monthsInRange(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (out.length > 120) break;
  }
  return out;
}

/**
 * Hoe elke maand ervoor staat tegenover het budget. Voor de lopende maand
 * wordt het tempo doorgetrokken: op de 10e al 60% uitgegeven is een ander
 * verhaal dan op de 28e.
 */
export function budgetStatus(
  rows: AdsDailyRow[],
  budgets: AdsBudgets,
  months: string[],
  today: string,
): MonthBudgetStatus[] {
  const spentBy = new Map<string, number>();
  for (const r of rows) {
    const m = r.date.substring(0, 7);
    spentBy.set(m, (spentBy.get(m) ?? 0) + r.cost);
  }
  const currentMonth = today.substring(0, 7);
  return months.map((month) => {
    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const isCurrent = month === currentMonth;
    const daysElapsed = isCurrent ? Number(today.substring(8, 10)) : month < currentMonth ? daysInMonth : 0;
    const spent = round2(spentBy.get(month) ?? 0);
    const budget = budgetForMonth(budgets, month);
    const pct = budget != null && budget > 0 ? Math.round((spent / budget) * 1000) / 10 : null;
    const projected = isCurrent && daysElapsed > 0 ? round2((spent / daysElapsed) * daysInMonth) : null;

    let signal: MonthBudgetStatus['signal'] = null;
    if (budget != null && budget > 0) {
      const vergelijk = isCurrent ? (projected ?? spent) : spent;
      const verhouding = vergelijk / budget;
      if (month > currentMonth) signal = null;
      else if (verhouding > 1.1) signal = 'crit';
      else if (verhouding > 1.0) signal = 'warn';
      else signal = 'good';
    }
    return {
      month,
      label: monthLabel(month),
      budget,
      budgetIsDefault: budgets[month] == null && budgets.default != null,
      spent,
      pct,
      projected,
      daysElapsed,
      daysInMonth,
      isCurrent,
      signal,
    };
  });
}

// ── Wat Google oplevert (uit Teamleader) ─────────────────────────────────
export interface GoogleLeadStats {
  revenue: number; // geaccepteerde omzet ex btw met leadbron Google
  margin: number; // som van de marges (alleen offertes mét marge)
  marginRevenue: number; // omzetbasis van die marges
  count: number;
  /** Aantal offertes zonder marge (geen inkoopprijs) — die zitten niet in `margin`. */
  unpricedCount: number;
}

const isGoogle = (source: string) => /google/i.test(source);

/**
 * Dezelfde koppeling als de leadbron-tabel (aggregate.ts): offerte → deal →
 * leadbron. Een deal met "Google, Mond op mond reclame" telt hier mee, net als
 * daar. Hier tellen we óók de marge in euro's op, want die staat niet in
 * LeadSourceStat.
 */
export function googleLeadStats(quotations: QuotationRow[], runTimeRows: RunTimeRow[]): GoogleLeadStats {
  const dealSource: Record<string, string> = {};
  for (const r of runTimeRows) if (r.dealId && r.leadSource) dealSource[r.dealId] = r.leadSource;
  const out: GoogleLeadStats = { revenue: 0, margin: 0, marginRevenue: 0, count: 0, unpricedCount: 0 };
  for (const q of quotations) {
    if (q.status !== 'accepted') continue;
    if (!isGoogle(dealSource[q.dealId] ?? '')) continue;
    out.revenue += q.revenueExVat;
    out.count += 1;
    if (q.margin !== null) {
      out.margin += q.margin;
      out.marginRevenue += q.revenueExVat;
    } else {
      out.unpricedCount += 1;
    }
  }
  out.revenue = round2(out.revenue);
  out.margin = round2(out.margin);
  out.marginRevenue = round2(out.marginRevenue);
  return out;
}

/** Zit "Google" (in welke combinatie ook) in deze leadbronlijst? */
export function hasGoogleSource(sources: LeadSourceStat[]): boolean {
  return sources.some((s) => isGoogle(s.name));
}

// ── Marge na marketing ───────────────────────────────────────────────────
export interface MarginAfterAds {
  /** Totale marge van de periode min de Ads-kosten van de periode. */
  net: number;
  /** Marge uit Google-leads min de Ads-kosten: wat de advertenties netto opleveren. */
  googleNet: number;
  /** Kosten per gewonnen Google-deal. Null zonder deals. */
  costPerWonDeal: number | null;
  /** Google-omzet per advertentie-euro. Null zonder kosten. */
  roas: number | null;
  /** Ads-kosten als percentage van de totale marge. Null zonder marge. */
  costShareOfMargin: number | null;
}

export function marginAfterAds(totalMargin: number, ads: AdsTotals, google: GoogleLeadStats): MarginAfterAds {
  return {
    net: round2(totalMargin - ads.cost),
    googleNet: round2(google.margin - ads.cost),
    costPerWonDeal: ratio2(ads.cost, google.count),
    roas: ratio2(google.revenue, ads.cost),
    costShareOfMargin: pct1(ads.cost, totalMargin),
  };
}

/** Procentueel verschil, of null als het niet te berekenen is. */
export function deltaPct(now: number | null | undefined, before: number | null | undefined): number | null {
  if (now == null || before == null || before === 0) return null;
  return Math.round(((now - before) / Math.abs(before)) * 1000) / 10;
}

// ── Google-leads per week (voor de sparkline naast de Ads-weken) ─────────
export interface GoogleWeekPoint {
  week: string;
  count: number;
  revenue: number;
  margin: number;
}

/**
 * Gewonnen offertes met leadbron Google per ISO-week, op dezelfde weken als
 * adsByWeek zodat de sparklines naast elkaar kloppen. Beslisdatum als die er
 * is (bij geaccepteerd altijd), anders aanmaakdatum — zoals overal.
 */
export function googleLeadsByWeek(
  quotations: QuotationRow[],
  runTimeRows: RunTimeRow[],
  weeks: string[],
): GoogleWeekPoint[] {
  const dealSource: Record<string, string> = {};
  for (const r of runTimeRows) if (r.dealId && r.leadSource) dealSource[r.dealId] = r.leadSource;
  const byWeek = new Map<string, GoogleWeekPoint>(weeks.map((w) => [w, { week: w, count: 0, revenue: 0, margin: 0 }]));
  for (const q of quotations) {
    if (q.status !== 'accepted' || !isGoogle(dealSource[q.dealId] ?? '')) continue;
    const d = q.dateAccepted || q.dateCreated;
    if (!d) continue;
    const w = getISOWeek(d);
    const p = byWeek.get(w);
    if (!p) continue;
    p.count += 1;
    p.revenue += q.revenueExVat;
    if (q.margin !== null) p.margin += q.margin;
  }
  return weeks.map((w) => byWeek.get(w)!);
}
