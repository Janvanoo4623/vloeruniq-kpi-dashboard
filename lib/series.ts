// Shape the snapshot's weekly maps into chronological (ascending) arrays for charts.
import type { QuotationRow, Snapshot } from './types';
import { getISOWeek, compareWeeksDesc } from './teamleader/dates';

export interface WeeklyPoint {
  week: string;
  acceptedRevenue: number;
  openRevenue: number;
  acceptedCount: number;
  openCount: number;
  refusedCount: number;
  expiredCount: number;
  expiredRevenue: number;
  conversionPct: number | null;
  margin: number;
  marginPct: number | null;
  m2: number;
  avgRunTime: number | null;
  dealsTracked: number;
}

export function weeklySeries(snapshot: Snapshot): WeeklyPoint[] {
  const weeksAsc = [...snapshot.weeks].reverse();
  return weeksAsc.map((week) => {
    const r = snapshot.revenue.byWeek[week];
    const rt = snapshot.runTime.byWeek[week];
    const acceptedCount = r?.acceptedCount ?? 0;
    const refusedCount = r?.refusedCount ?? 0;
    // Verlopen telt als verloren — zie aggregate.ts.
    const expiredCount = r?.expiredCount ?? 0;
    const decided = acceptedCount + refusedCount + expiredCount;
    const conversionPct = decided > 0 ? Math.round((acceptedCount / decided) * 1000) / 10 : null;
    const marginPct =
      r && r.acceptedMarginRev > 0
        ? Math.round((r.acceptedMargin / r.acceptedMarginRev) * 1000) / 10
        : null;

    return {
      week,
      acceptedRevenue: r?.acceptedRevenue ?? 0,
      openRevenue: r?.openRevenue ?? 0,
      acceptedCount,
      openCount: r?.openCount ?? 0,
      refusedCount,
      expiredCount,
      expiredRevenue: r?.expiredRevenue ?? 0,
      conversionPct,
      margin: r?.acceptedMargin ?? 0,
      marginPct,
      m2: r?.acceptedM2 ?? 0,
      avgRunTime: rt && rt.count > 0 ? Math.round((rt.totalDays / rt.count) * 10) / 10 : null,
      dealsTracked: rt?.count ?? 0,
    };
  });
}

// ── Time series for the Trends view (week or month granularity) ──────────
export type Granularity = 'week' | 'month';

export interface TimePoint {
  key: string;
  label: string;
  acceptedRevenue: number;
  openRevenue: number;
  acceptedCount: number;
  refusedCount: number;
  expiredCount: number;
  expiredRevenue: number;
  margin: number;
  marginRev: number;
  marginPct: number | null;
  conversionPct: number | null;
  m2: number;
  runDays: number;
  runCount: number;
  avgRunTime: number | null;
  cumulativeAccepted: number;
}

// Elke afgeronde offerte (geaccepteerd, geweigerd, verlopen) hoort thuis op de
// datum waarop dat gebeurde; alleen een nog open offerte valt op zijn aanmaakdatum.
function relevantDate(q: QuotationRow): string {
  return q.status !== 'open' && q.dateAccepted ? q.dateAccepted : q.dateCreated;
}

const monthKey = (d: string) => d.substring(0, 7);
const round2 = (v: number) => Math.round(v * 100) / 100;

function emptyPoint(key: string): TimePoint {
  return {
    key,
    label: key,
    acceptedRevenue: 0,
    openRevenue: 0,
    acceptedCount: 0,
    refusedCount: 0,
    expiredCount: 0,
    expiredRevenue: 0,
    margin: 0,
    marginRev: 0,
    marginPct: null,
    conversionPct: null,
    m2: 0,
    runDays: 0,
    runCount: 0,
    avgRunTime: null,
    cumulativeAccepted: 0,
  };
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('nl-NL', {
    month: 'short',
    year: '2-digit',
  });
}

/** Build a chronological time series from the snapshot's quotations + deals. */
export function buildTimeSeries(snapshot: Snapshot, granularity: Granularity): TimePoint[] {
  const keyOf = (d: string) => (granularity === 'month' ? monthKey(d) : getISOWeek(d));
  const buckets = new Map<string, TimePoint>();
  const get = (key: string) => {
    let p = buckets.get(key);
    if (!p) {
      p = emptyPoint(key);
      buckets.set(key, p);
    }
    return p;
  };

  for (const q of snapshot.quotations) {
    const d = relevantDate(q);
    if (!d) continue;
    const p = get(keyOf(d));
    if (q.status === 'accepted') {
      p.acceptedRevenue += q.revenueExVat;
      p.acceptedCount += 1;
      p.m2 += q.totalM2;
      if (q.margin !== null) {
        p.margin += q.margin;
        p.marginRev += q.revenueExVat;
      }
    } else if (q.status === 'open') {
      p.openRevenue += q.revenueExVat;
    } else if (q.status === 'refused') {
      p.refusedCount += 1;
    } else if (q.status === 'expired') {
      p.expiredCount += 1;
      p.expiredRevenue += q.revenueExVat;
    }
  }

  for (const r of snapshot.runTimeRows) {
    if (!r.dateAccepted) continue;
    const p = get(keyOf(r.dateAccepted));
    p.runDays += r.runTimeDays;
    p.runCount += 1;
  }

  const keys = [...buckets.keys()].sort((a, b) =>
    granularity === 'month' ? a.localeCompare(b) : -compareWeeksDesc(a, b),
  );

  let cumulative = 0;
  return keys.map((key) => {
    const p = buckets.get(key)!;
    cumulative += p.acceptedRevenue;
    const decided = p.acceptedCount + p.refusedCount + p.expiredCount;
    return {
      ...p,
      expiredRevenue: round2(p.expiredRevenue),
      label: granularity === 'month' ? monthLabel(key) : key.split('-W').map((s, i) => (i ? `W${s}` : ''))[1] ?? key,
      acceptedRevenue: round2(p.acceptedRevenue),
      openRevenue: round2(p.openRevenue),
      margin: round2(p.margin),
      m2: round2(p.m2),
      marginPct: p.marginRev > 0 ? Math.round((p.margin / p.marginRev) * 1000) / 10 : null,
      conversionPct: decided > 0 ? Math.round((p.acceptedCount / decided) * 1000) / 10 : null,
      avgRunTime: p.runCount > 0 ? Math.round((p.runDays / p.runCount) * 10) / 10 : null,
      cumulativeAccepted: round2(cumulative),
    };
  });
}
