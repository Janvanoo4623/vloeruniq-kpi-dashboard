// Vijf analyses op data die er al lag maar nergens werd getoond.
//
// Eén regel geldt overal in dit bestand: een percentage over te weinig
// waarnemingen wordt NIET getoond. Elke functie geeft het aantal terug waarop
// hij steunt, zodat de UI dat ernaast kan zetten in plaats van een cijfer te
// suggereren dat er niet is.
import type { InstallMode, QuotationRow, RunTimeRow } from './types';
import { countsAsLost, type KpiSettings } from './kpi-settings';

const DAY = 86400000;
const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

const daysBetween = (from: string, to: string): number =>
  Math.floor((Date.parse(to) - Date.parse(from)) / DAY);

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Splitst offertes in gewonnen / verloren / nog onbeslist volgens de instellingen. */
function outcome(
  q: QuotationRow,
  asOf: string,
  s: KpiSettings,
): 'won' | 'lost' | 'undecided' {
  if (q.status === 'accepted') return 'won';
  const age = q.dateCreated ? daysBetween(q.dateCreated, asOf) : 0;
  if (countsAsLost(q.status, age, s)) return 'lost';
  return 'undecided';
}

// ── 1. Winkans per ordergrootte + per maand ──────────────────────────────

export interface WinRateBucket {
  label: string;
  won: number;
  lost: number;
  /** null zodra er te weinig waarnemingen zijn — zie KpiSettings.minSample. */
  winRate: number | null;
  value: number; // gewonnen omzet in deze bucket
}

const SIZE_BUCKETS: { label: string; max: number }[] = [
  { label: '< €1k', max: 1000 },
  { label: '€1–2,5k', max: 2500 },
  { label: '€2,5–5k', max: 5000 },
  { label: '€5–10k', max: 10000 },
  { label: '> €10k', max: Infinity },
];

/** Win ik de grote klussen net zo vaak als de kleine? */
export function winRateBySize(
  quotations: QuotationRow[],
  asOf: string,
  s: KpiSettings,
): WinRateBucket[] {
  const buckets = SIZE_BUCKETS.map((b) => ({ label: b.label, won: 0, lost: 0, winRate: null as number | null, value: 0 }));
  for (const q of quotations) {
    const o = outcome(q, asOf, s);
    if (o === 'undecided') continue;
    const i = SIZE_BUCKETS.findIndex((b) => q.revenueExVat < b.max);
    const b = buckets[i < 0 ? buckets.length - 1 : i];
    if (o === 'won') {
      b.won += 1;
      b.value += q.revenueExVat;
    } else b.lost += 1;
  }
  for (const b of buckets) {
    const n = b.won + b.lost;
    b.winRate = n >= s.minSample ? round1((b.won / n) * 100) : null;
    b.value = Math.round(b.value);
  }
  return buckets;
}

export interface WinRatePoint {
  month: string; // YYYY-MM
  won: number;
  lost: number;
  decided: number; // won + lost, als staafhoogte
  winRate: number | null;
  /** De laatste maanden zijn nog niet uitgehard: offertes kunnen nog kantelen. */
  provisional: boolean;
}

/**
 * Winkans per maand. De laatste `maturityDays` aan maanden is per definitie nog
 * niet uitgehard — daar staan offertes die simpelweg nog geen kans hebben gehad
 * om te verlopen. Die markeren we als voorlopig in plaats van ze mee te tellen
 * alsof ze af zijn.
 */
export function winRateByMonth(
  quotations: QuotationRow[],
  asOf: string,
  s: KpiSettings,
): WinRatePoint[] {
  const map = new Map<string, { won: number; lost: number }>();
  for (const q of quotations) {
    if (!q.dateCreated) continue;
    const o = outcome(q, asOf, s);
    if (o === 'undecided') continue;
    const key = q.dateCreated.substring(0, 7);
    const m = map.get(key) ?? { won: 0, lost: 0 };
    if (o === 'won') m.won += 1;
    else m.lost += 1;
    map.set(key, m);
  }
  const cutoff = new Date(Date.parse(asOf) - s.maturityDays * DAY).toISOString().substring(0, 7);
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, m]) => {
      const n = m.won + m.lost;
      return {
        month,
        won: m.won,
        lost: m.lost,
        decided: n,
        winRate: n >= 3 ? round1((m.won / n) * 100) : null,
        provisional: month >= cutoff,
      };
    });
}

// ── 2. Legwijze-mix ──────────────────────────────────────────────────────

export interface InstallModeStat {
  mode: InstallMode;
  label: string;
  m2: number;
  revenue: number;
  margin: number | null;
  lines: number;
  pricePerM2: number | null;
  marginPct: number | null;
}

export interface InstallMixPoint {
  quarter: string;
  glued: number;
  click: number;
  selfadhesive: number;
}

const MODE_LABEL: Record<InstallMode, string> = {
  glued: 'Gelijmd',
  click: 'Klik',
  selfadhesive: 'Zelfklevend',
};

/**
 * Verkoop ik steeds meer klik, en wat doet dat met de marge? Alleen geaccepteerde
 * offertes: een verlopen offerte zegt niets over wat er daadwerkelijk ligt.
 */
export function installModeStats(quotations: QuotationRow[]): {
  totals: InstallModeStat[];
  byQuarter: InstallMixPoint[];
} {
  const acc = new Map<InstallMode, { m2: number; revenue: number; margin: number; marginRev: number; lines: number; priced: number }>();
  const quarters = new Map<string, InstallMixPoint>();

  for (const q of quotations) {
    if (q.status !== 'accepted') continue;
    for (const l of q.lines ?? []) {
      const mode = l.installMode;
      if (!mode) continue;
      const a = acc.get(mode) ?? { m2: 0, revenue: 0, margin: 0, marginRev: 0, lines: 0, priced: 0 };
      a.m2 += l.m2;
      a.revenue += l.revenue;
      a.lines += 1;
      if (l.margin != null) {
        a.margin += l.margin;
        a.marginRev += l.revenue;
        a.priced += 1;
      }
      acc.set(mode, a);

      if (q.quarter) {
        const p = quarters.get(q.quarter) ?? { quarter: q.quarter, glued: 0, click: 0, selfadhesive: 0 };
        p[mode] += l.m2;
        quarters.set(q.quarter, p);
      }
    }
  }

  const totals: InstallModeStat[] = (['glued', 'click', 'selfadhesive'] as InstallMode[])
    .filter((m) => acc.has(m))
    .map((mode) => {
      const a = acc.get(mode)!;
      return {
        mode,
        label: MODE_LABEL[mode],
        m2: round1(a.m2),
        revenue: Math.round(a.revenue),
        margin: a.priced > 0 ? Math.round(a.margin) : null,
        lines: a.lines,
        pricePerM2: a.m2 > 0 ? round2(a.revenue / a.m2) : null,
        marginPct: a.marginRev > 0 ? round1((a.margin / a.marginRev) * 100) : null,
      };
    });

  const byQuarter = [...quarters.values()].sort((a, b) => {
    const [qa, ya] = a.quarter.split(' ');
    const [qb, yb] = b.quarter.split(' ');
    return ya === yb ? qa.localeCompare(qb) : ya.localeCompare(yb);
  });

  return { totals, byQuarter };
}

// ── 3. Regio-diepte ──────────────────────────────────────────────────────

export interface RegionInsight {
  name: string;
  quotes: number; // beslist (gewonnen + verloren)
  won: number;
  winRate: number | null;
  revenue: number;
  marginPct: number | null;
  m2: number;
}

/**
 * `city` is vrije tekst: "ALMELO", "almelo" en " Almelo " zijn hetzelfde. Zonder
 * normaliseren telt elke schrijfwijze als een eigen plaats (136 ruwe waarden op
 * 87 echte plaatsen).
 */
export function normaliseCity(raw: string): string {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return t
    .toLocaleLowerCase('nl')
    .split(' ')
    .map((w) => w.charAt(0).toLocaleUpperCase('nl') + w.slice(1))
    .join(' ');
}

/** Waar win ik makkelijk én verdien ik goed? */
export function regionInsights(
  quotations: QuotationRow[],
  asOf: string,
  s: KpiSettings,
): RegionInsight[] {
  const map = new Map<string, { quotes: number; won: number; revenue: number; margin: number; marginRev: number; m2: number }>();

  for (const q of quotations) {
    const city = normaliseCity(q.city ?? '');
    if (!city) continue;
    const o = outcome(q, asOf, s);
    if (o === 'undecided') continue;
    const r = map.get(city) ?? { quotes: 0, won: 0, revenue: 0, margin: 0, marginRev: 0, m2: 0 };
    r.quotes += 1;
    if (o === 'won') {
      r.won += 1;
      r.revenue += q.revenueExVat;
      r.m2 += q.totalM2;
      if (q.margin != null && q.omzetVloer > 0) {
        r.margin += q.margin;
        r.marginRev += q.omzetVloer;
      }
    }
    map.set(city, r);
  }

  return [...map.entries()]
    .map(([name, r]) => ({
      name,
      quotes: r.quotes,
      won: r.won,
      // Onder minSample offertes zegt een winkans niets — dan liever geen getal.
      winRate: r.quotes >= s.minSample ? round1((r.won / r.quotes) * 100) : null,
      revenue: Math.round(r.revenue),
      marginPct: r.marginRev > 0 ? round1((r.margin / r.marginRev) * 100) : null,
      m2: round1(r.m2),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ── 4. Beslistijd van de klant ───────────────────────────────────────────

export interface DecisionTime {
  buckets: { label: string; count: number; share: number }[];
  medianDays: number | null;
  p90Days: number | null;
  sample: number;
  sameDay: number;
  after30: number;
}

const DECISION_BUCKETS: { label: string; max: number }[] = [
  { label: 'Zelfde dag', max: 1 },
  { label: '1–7 dagen', max: 8 },
  { label: '8–30 dagen', max: 31 },
  { label: '31–90 dagen', max: 91 },
  { label: '90+ dagen', max: Infinity },
];

/** Hoe lang doet een klant erover om ja te zeggen? */
export function decisionTimes(quotations: QuotationRow[]): DecisionTime {
  const days: number[] = [];
  for (const q of quotations) {
    if (q.status !== 'accepted' || !q.dateCreated || !q.dateAccepted) continue;
    const d = daysBetween(q.dateCreated, q.dateAccepted);
    if (d >= 0 && d < 3650) days.push(d);
  }
  const buckets = DECISION_BUCKETS.map((b) => ({ label: b.label, count: 0, share: 0 }));
  for (const d of days) {
    const i = DECISION_BUCKETS.findIndex((b) => d < b.max);
    buckets[i < 0 ? buckets.length - 1 : i].count += 1;
  }
  for (const b of buckets) b.share = days.length > 0 ? round1((b.count / days.length) * 100) : 0;

  const sorted = [...days].sort((a, b) => a - b);
  return {
    buckets,
    medianDays: median(days),
    p90Days: sorted.length > 0 ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] : null,
    sample: days.length,
    sameDay: days.filter((d) => d === 0).length,
    after30: days.filter((d) => d > 30).length,
  };
}

// ── 5. Orderportefeuille per uitvoeringsmaand ────────────────────────────

export interface PlanningPoint {
  month: string; // YYYY-MM
  jobs: number;
  m2: number;
  revenue: number;
  past: boolean;
}

export interface PlanningOverview {
  months: PlanningPoint[];
  /** Nog uit te voeren: alles met een uitvoerdatum in de toekomst. */
  backlogJobs: number;
  backlogM2: number;
  backlogRevenue: number;
  /** Aantal deals waarop dit steunt — bewust zichtbaar, het zijn er weinig. */
  sample: number;
}

/**
 * Wat staat er ingepland? Koppelt de uitvoerdatum uit `deals` aan de m² en omzet
 * van de bijbehorende offerte.
 *
 * Let op: `deals` is de dunste tabel die we hebben en begint pas in februari
 * 2026. Een lege maand betekent hier vrijwel zeker "nog niet ingepland", niet
 * "geen werk" — de UI moet dat zeggen, niet suggereren dat het werk opdroogt.
 */
export function planningOverview(
  deals: RunTimeRow[],
  quotations: QuotationRow[],
  asOf: string,
): PlanningOverview {
  const byDeal = new Map<string, QuotationRow>();
  for (const q of quotations) {
    if (q.dealId && q.status === 'accepted') byDeal.set(q.dealId, q);
  }

  const nowMonth = asOf.substring(0, 7);
  const map = new Map<string, PlanningPoint>();
  let backlogJobs = 0;
  let backlogM2 = 0;
  let backlogRevenue = 0;
  let sample = 0;

  for (const d of deals) {
    if (!d.dateExecution) continue;
    const q = byDeal.get(d.dealId);
    const month = d.dateExecution.substring(0, 7);
    const p = map.get(month) ?? { month, jobs: 0, m2: 0, revenue: 0, past: month < nowMonth };
    p.jobs += 1;
    p.m2 += q?.totalM2 ?? 0;
    p.revenue += q?.revenueExVat ?? 0;
    map.set(month, p);
    sample += 1;

    if (d.dateExecution > asOf) {
      backlogJobs += 1;
      backlogM2 += q?.totalM2 ?? 0;
      backlogRevenue += q?.revenueExVat ?? 0;
    }
  }

  const months = [...map.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((p) => ({ ...p, m2: round1(p.m2), revenue: Math.round(p.revenue) }));

  return {
    months,
    backlogJobs,
    backlogM2: round1(backlogM2),
    backlogRevenue: Math.round(backlogRevenue),
    sample,
  };
}

// ── 6. Leadbron-verloop over tijd ────────────────────────────────────────

export interface LeadSourcePoint {
  month: string; // YYYY-MM
  /** Omzet per bron; alleen de bronnen uit `topSources` plus "Overig". */
  [source: string]: number | string;
}

export interface LeadSourceTrend {
  points: LeadSourcePoint[];
  /** De bronnen die groot genoeg zijn om apart te tonen, grootste eerst. */
  sources: string[];
  /** Aandeel per bron over de hele periode, voor de samenvatting eronder. */
  totals: { name: string; revenue: number; share: number }[];
}

/**
 * Hoe verhouden de leadbronnen zich over tijd? Alleen geaccepteerde offertes —
 * een verlopen offerte zegt niets over wat een bron oplevert.
 *
 * Kleine bronnen worden samengevoegd tot "Overig": zes lijnen zijn te volgen,
 * twintig niet, en een bron met twee offertes in twee jaar levert alleen ruis.
 */
export function leadSourceTrend(
  quotations: QuotationRow[],
  deals: RunTimeRow[],
  maxSources = 5,
): LeadSourceTrend {
  // De leadbron staat op de deal, niet op de offerte; koppelen gaat via dealId.
  // Een deal kan meerdere bronnen hebben ("Google, Netwerk"); we nemen de eerste,
  // want anders telt dezelfde omzet dubbel in de grafiek.
  const bronPerDeal: Record<string, string> = {};
  for (const d of deals) {
    if (!d.dealId || !d.leadSource) continue;
    bronPerDeal[d.dealId] = d.leadSource.split(',')[0].trim();
  }
  const perSource = new Map<string, number>();
  const perMonth = new Map<string, Map<string, number>>();

  for (const q of quotations) {
    if (q.status !== 'accepted') continue;
    const datum = q.dateAccepted || q.dateCreated;
    if (!datum) continue;
    const bron = bronPerDeal[q.dealId] || 'Onbekend';
    perSource.set(bron, (perSource.get(bron) ?? 0) + q.revenueExVat);
    const maand = datum.substring(0, 7);
    const m = perMonth.get(maand) ?? new Map<string, number>();
    m.set(bron, (m.get(bron) ?? 0) + q.revenueExVat);
    perMonth.set(maand, m);
  }

  const gesorteerd = [...perSource.entries()].sort((a, b) => b[1] - a[1]);
  const groot = gesorteerd.slice(0, maxSources).map(([naam]) => naam);
  const heeftOverig = gesorteerd.length > maxSources;
  const sources = heeftOverig ? [...groot, 'Overig'] : groot;

  const points: LeadSourcePoint[] = [...perMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, m]) => {
      const punt: LeadSourcePoint = { month };
      for (const bron of groot) punt[bron] = Math.round(m.get(bron) ?? 0);
      if (heeftOverig) {
        let overig = 0;
        for (const [naam, waarde] of m) if (!groot.includes(naam)) overig += waarde;
        punt.Overig = Math.round(overig);
      }
      return punt;
    });

  const totaal = gesorteerd.reduce((s, [, v]) => s + v, 0);
  const totals = sources.map((naam) => {
    const revenue =
      naam === 'Overig'
        ? gesorteerd.slice(maxSources).reduce((s, [, v]) => s + v, 0)
        : (perSource.get(naam) ?? 0);
    return {
      name: naam,
      revenue: Math.round(revenue),
      share: totaal > 0 ? round1((revenue / totaal) * 100) : 0,
    };
  });

  return { points, sources, totals };
}

// ── 7. Marge-spreiding per product ───────────────────────────────────────

export interface ProductSpread {
  code: string;
  /** Aantal geaccepteerde offertes waarin dit product voorkomt. */
  quotes: number;
  m2: number;
  revenue: number;
  /** Mediane marge per m², in euro. */
  medianMarginPerM2: number;
  minMarginPerM2: number;
  maxMarginPerM2: number;
  medianPricePerM2: number;
  medianMarginPct: number;
  /** De inkoopprijs waarop dit alles rust. */
  purchasePerM2: number | null;
  /** Hoe ver de slechtste offerte onder de mediaan zit, in euro per m². */
  downside: number;
}

/**
 * Marge per m² per product, als spreiding in plaats van als gemiddelde.
 *
 * Een gemiddelde verbergt hier precies het interessante: een product met een
 * nette gemiddelde marge kan bestaan uit een paar goede offertes en een paar
 * waarin flink is weggegeven. De afstand tussen de slechtste en de mediaan is
 * wat je kunt terugpakken, en dat is een ander gesprek dan "dit product loopt
 * slecht".
 *
 * Alleen producten met minstens `minQuotes` offertes: onder de drie is een
 * mediaan een toevalstreffer.
 */
export function productSpread(
  quotations: QuotationRow[],
  minQuotes = 3,
  /**
   * Minimale m² per regel. Een marge per m² die over één vierkante meter wordt
   * uitgerekend is geen prijspunt maar een artefact: er staat een offerteregel
   * met aantal 1 en EUR 421,60 marge, wat neerkomt op EUR 421,60/m². Zulke regels
   * verpesten niet alleen hun eigen product maar de schaal van de hele grafiek.
   */
  minM2 = 5,
): ProductSpread[] {
  const per = new Map<
    string,
    { marges: number[]; prijzen: number[]; pcts: number[]; m2: number; revenue: number; inkoop: number | null; offertes: Set<string> }
  >();

  for (const q of quotations) {
    if (q.status !== 'accepted') continue;
    for (const l of q.lines ?? []) {
      if (l.margin == null || l.m2 < minM2) continue;
      const e =
        per.get(l.code) ??
        { marges: [], prijzen: [], pcts: [], m2: 0, revenue: 0, inkoop: null, offertes: new Set<string>() };
      e.marges.push(l.margin / l.m2);
      e.prijzen.push(l.revenue / l.m2);
      if (l.revenue > 0) e.pcts.push((l.margin / l.revenue) * 100);
      e.m2 += l.m2;
      e.revenue += l.revenue;
      if (e.inkoop == null && l.purchasePerM2 != null) e.inkoop = l.purchasePerM2;
      e.offertes.add(q.id);
      per.set(l.code, e);
    }
  }

  const mediaan = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  return [...per.entries()]
    .filter(([, e]) => e.offertes.size >= minQuotes)
    .map(([code, e]) => {
      const med = mediaan(e.marges);
      const min = Math.min(...e.marges);
      return {
        code,
        quotes: e.offertes.size,
        m2: round1(e.m2),
        revenue: Math.round(e.revenue),
        medianMarginPerM2: round2(med),
        minMarginPerM2: round2(min),
        maxMarginPerM2: round2(Math.max(...e.marges)),
        medianPricePerM2: round2(mediaan(e.prijzen)),
        medianMarginPct: e.pcts.length > 0 ? round1(mediaan(e.pcts)) : 0,
        purchasePerM2: e.inkoop,
        downside: round2(med - min),
      };
    })
    .sort((a, b) => a.medianMarginPerM2 - b.medianMarginPerM2);
}
