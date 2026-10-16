// "Vandaag": wat niet van de periodekiezer afhangt maar van de kalender.
//
//  - De belijst: open offertes gesorteerd op wat ze waarschijnlijk opleveren.
//  - De lopende maand tegenover het maanddoel en tegenover vorige maand op
//    dezelfde dag.
//  - Het break-evenpunt: welke omzet er per maand nodig is om de vaste lasten
//    uit Moneybird te dekken.
//
// Alles wordt in de layout berekend (één keer per render) en gaat via de
// DashboardProvider naar Overzicht, Pijplijn en Resultaat.
import type { QuotationRow } from './types';
import type { MoneybirdPL } from './moneybird';

const DAY = 86400000;
const r0 = (v: number) => Math.round(v);
const r1 = (v: number) => Math.round(v * 10) / 10;

// ── Belijst ──────────────────────────────────────────────────────────────

export interface CallItem {
  quotationId: string;
  name: string;
  customerName: string;
  city: string;
  value: number; // ex btw
  daysOpen: number;
  /** Kans dat een offerte van deze leeftijd nog gewonnen wordt, 0–100. */
  winChance: number;
  /** value × winChance — waar de lijst op sorteert. */
  expected: number;
}

export interface CallList {
  items: CallItem[];
  /** Op hoeveel beslissingen de kanscurve gebaseerd is. */
  basis: number;
}

/**
 * De kans dat een offerte die na `a` dagen nog open staat alsnog gewonnen
 * wordt: van alle besliste offertes die op dag `a` nog niet geaccepteerd waren,
 * welk deel werd het daarna alsnog?
 *
 * Alleen de acceptatiedatum is hier bruikbaar. Bij verlopen offertes ligt de
 * "beslisdatum" in de helft van de gevallen op de aanmaakdag zelf (gemeten
 * 2026-10-16: mediaan 0 dagen over 456 verlopen offertes) — dat is wanneer
 * Teamleader de status zette, niet wanneer de klant afhaakte. Een verloren
 * offerte telt daarom als "stond op dag a nog open". Dat maakt de kans eerder
 * te laag dan te hoog, en dat is de goede kant om je te vergissen bij wie je belt.
 *
 * Dat is eerlijker dan één winkans voor alles: een offerte van 3 dagen oud
 * heeft een heel andere kans dan een van 50 dagen.
 */
function winCurve(quotations: QuotationRow[]): { at: (age: number) => number; basis: number } {
  const gewonnenOp: number[] = [];
  let beslist = 0;
  for (const q of quotations) {
    if (q.status === 'open' || !q.dateCreated) continue;
    beslist += 1;
    if (q.status === 'accepted' && q.dateAccepted) {
      gewonnenOp.push(Math.max(0, Math.floor((Date.parse(q.dateAccepted) - Date.parse(q.dateCreated)) / DAY)));
    }
  }
  const cache = new Map<number, number>();
  const at = (age: number) => {
    const hit = cache.get(age);
    if (hit != null) return hit;
    const alGewonnen = gewonnenOp.filter((d) => d < age).length;
    const nogOpen = beslist - alGewonnen;
    const later = gewonnenOp.length - alGewonnen;
    const p = nogOpen > 0 ? (later / nogOpen) * 100 : 0;
    cache.set(age, p);
    return p;
  };
  return { at, basis: beslist };
}

export function computeCallList(
  quotations: QuotationRow[],
  exclusions: Set<string>,
  asOf: string,
  limit = 30,
): CallList {
  const included = quotations.filter((q) => !exclusions.has(q.id));
  const curve = winCurve(included);
  const now = Date.parse(asOf);
  const items: CallItem[] = included
    .filter((q) => q.status === 'open' && q.dateCreated && q.revenueExVat > 0)
    .map((q) => {
      const daysOpen = Math.max(0, Math.floor((now - Date.parse(q.dateCreated)) / DAY));
      const winChance = r1(curve.at(daysOpen));
      return {
        quotationId: q.id,
        name: q.name,
        customerName: q.customerName,
        city: q.city,
        value: r0(q.revenueExVat),
        daysOpen,
        winChance,
        expected: r0((q.revenueExVat * winChance) / 100),
      };
    })
    // Een offerte van gisteren hoef je nog niet na te bellen; die wint de
    // sortering anders altijd omdat de kans dan het hoogst is.
    .filter((c) => c.daysOpen >= 5)
    .sort((a, b) => b.expected - a.expected)
    .slice(0, limit);
  return { items, basis: curve.basis };
}

// ── De lopende maand ─────────────────────────────────────────────────────

export interface Goals {
  /** Maanddoel geaccepteerde omzet, ex btw. */
  revenue: number | null;
  /** Maanddoel marge, ex btw. */
  margin: number | null;
  /** Maanddoel verkochte m². */
  m2: number | null;
}

export const EMPTY_GOALS: Goals = { revenue: null, margin: null, m2: null };

export interface MonthProgress {
  month: string; // YYYY-MM
  day: number; // dag van de maand (vandaag)
  daysInMonth: number;
  revenue: number;
  margin: number;
  m2: number;
  count: number;
  /** Vorige maand t/m dezelfde dag, voor "loop je voor of achter". */
  prevSameDay: { revenue: number; margin: number; m2: number };
  /** Vorige maand in totaal. */
  prevTotal: { revenue: number; margin: number; m2: number };
  goals: Goals;
}

export function computeMonthProgress(
  quotations: QuotationRow[],
  exclusions: Set<string>,
  asOf: string,
  goals: Goals,
): MonthProgress {
  const month = asOf.slice(0, 7);
  const day = Number(asOf.slice(8, 10));
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const prevDays = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  const prevCut = `${prev}-${String(Math.min(day, prevDays)).padStart(2, '0')}`;

  const cur = { revenue: 0, margin: 0, m2: 0, count: 0 };
  const same = { revenue: 0, margin: 0, m2: 0 };
  const tot = { revenue: 0, margin: 0, m2: 0 };
  for (const q of quotations) {
    if (q.status !== 'accepted' || !q.dateAccepted || exclusions.has(q.id)) continue;
    const d = q.dateAccepted;
    const add = (t: { revenue: number; margin: number; m2: number }) => {
      t.revenue += q.revenueExVat;
      t.margin += q.margin ?? 0;
      t.m2 += q.totalM2;
    };
    if (d.startsWith(month) && d <= asOf) {
      add(cur);
      cur.count += 1;
    } else if (d.startsWith(prev)) {
      add(tot);
      if (d <= prevCut) add(same);
    }
  }
  const round = (t: { revenue: number; margin: number; m2: number }) => ({ revenue: r0(t.revenue), margin: r0(t.margin), m2: r0(t.m2) });
  return {
    month,
    day,
    daysInMonth,
    ...round(cur),
    count: cur.count,
    prevSameDay: round(same),
    prevTotal: round(tot),
    goals,
  };
}

// ── Break-even ───────────────────────────────────────────────────────────

export interface BreakEven {
  /** Vaste lasten per maand: bedrijfskosten uit Moneybird, gemiddeld over de complete maanden. */
  fixedPerMonth: number;
  /** Brutomarge als fractie van de omzet (omzet − directe kosten) / omzet. */
  grossMarginPct: number;
  /** Omzet die per maand nodig is om de vaste lasten te dekken. */
  revenueNeeded: number;
  /** Over hoeveel maanden het gemiddelde loopt. */
  months: number;
  /** Gefactureerd deze maand tot nu toe (Teamleader), voor de voortgang. */
  invoicedThisMonth: number;
}

/**
 * Hoeveel omzet heb je per maand nodig om quitte te spelen?
 * Vaste lasten ÷ brutomarge. Beide uit de laatste (max.) zes complete maanden,
 * zonder de lopende maand: die is nog niet volledig geboekt.
 */
export function computeBreakEven(
  pl: MoneybirdPL,
  revenueByMonth: Map<string, number>,
  startMonth: string,
  asOf: string,
): BreakEven | null {
  const thisMonth = asOf.slice(0, 7);
  const maanden = pl.months.filter((m) => m.month >= startMonth && m.month < thisMonth).slice(-6);
  if (maanden.length === 0) return null;
  const omzet = maanden.reduce((s, m) => s + (revenueByMonth.get(m.month) ?? 0), 0);
  const direct = maanden.reduce((s, m) => s + m.directCosts, 0);
  const vast = maanden.reduce((s, m) => s + m.expenses - m.other, 0) / maanden.length;
  if (omzet <= 0) return null;
  const bruto = (omzet - direct) / omzet;
  if (bruto <= 0) return null;
  return {
    fixedPerMonth: r0(vast),
    grossMarginPct: r1(bruto * 100),
    revenueNeeded: r0(vast / bruto),
    months: maanden.length,
    invoicedThisMonth: r0(revenueByMonth.get(thisMonth) ?? 0),
  };
}

// ── Trendlijntjes voor de tegels ────────────────────────────────────────

export interface TileTrends {
  revenue: number[];
  margin: number[];
  m2: number[];
  marginAfterAds: number[];
}

/**
 * Per week het lopende 4-wekentotaal, over het laatste halfjaar (26 punten,
 * het laatste is vandaag). De tegels lieten eerst de weken van de gekozen
 * periode zien: vijf punten waarvan de eerste en laatste een halve week, dus
 * een zigzag die niets zei. Een voortschrijdend totaal is rustig en laat zien
 * waar het werkelijk heen gaat.
 */
export function computeTileTrends(
  quotations: QuotationRow[],
  exclusions: Set<string>,
  ads: { date: string; cost: number }[],
  asOf: string,
  weeks = 26,
): TileTrends {
  const end = Date.parse(asOf);
  const perDag = new Map<string, { revenue: number; margin: number; m2: number; ads: number }>();
  const dag = (d: string) => {
    const e = perDag.get(d) ?? { revenue: 0, margin: 0, m2: 0, ads: 0 };
    perDag.set(d, e);
    return e;
  };
  for (const q of quotations) {
    if (q.status !== 'accepted' || !q.dateAccepted || exclusions.has(q.id)) continue;
    const e = dag(q.dateAccepted);
    e.revenue += q.revenueExVat;
    e.margin += q.margin ?? 0;
    e.m2 += q.totalM2;
  }
  for (const a of ads) dag(a.date).ads += a.cost;

  const out: TileTrends = { revenue: [], margin: [], m2: [], marginAfterAds: [] };
  for (let w = weeks - 1; w >= 0; w--) {
    const tot = end - w * 7 * DAY;
    const van = tot - 27 * DAY;
    let revenue = 0;
    let margin = 0;
    let m2 = 0;
    let adsCost = 0;
    for (let t = van; t <= tot; t += DAY) {
      const e = perDag.get(new Date(t).toISOString().slice(0, 10));
      if (!e) continue;
      revenue += e.revenue;
      margin += e.margin;
      m2 += e.m2;
      adsCost += e.ads;
    }
    out.revenue.push(r0(revenue));
    out.margin.push(r0(margin));
    out.m2.push(r0(m2));
    out.marginAfterAds.push(r0(margin - adsCost));
  }
  return out;
}
