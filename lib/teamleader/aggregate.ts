// Weekly aggregation + lead-source revenue -> Snapshot. Pure function (no I/O),
// faithful port of buildOverview. See docs/DATA-MODEL.md.

import { compareWeeksDesc, getISOWeek, round } from './dates';
import type { AggLine } from './quotations';
import type {
  InvoicingSummary,
  LeadSourceStat,
  ProductStat,
  QuotationRow,
  RegionStat,
  RunTimeRow,
  Snapshot,
  WeekRevenue,
  WeekRunTime,
} from '../types';

function emptyWeekRevenue(): WeekRevenue {
  return {
    acceptedRevenue: 0,
    openRevenue: 0,
    refusedRevenue: 0,
    acceptedCount: 0,
    openCount: 0,
    refusedCount: 0,
    acceptedM2: 0,
    acceptedMargin: 0,
    acceptedMarginRev: 0,
  };
}

/** The date that buckets a quotation into a week (accepted/refused date else created). */
function relevantDate(q: QuotationRow): string {
  if ((q.status === 'accepted' || q.status === 'refused') && q.dateAccepted) {
    return q.dateAccepted;
  }
  return q.dateCreated;
}

export function buildSnapshot(
  quotations: QuotationRow[],
  runTimeRows: RunTimeRow[],
  productLines: AggLine[],
  invoicing: InvoicingSummary,
  lookbackDays: number,
  generatedAt: string,
): Snapshot {
  // ── Revenue per week ────────────────────────────────────────────────
  const revenueByWeekRaw: Record<string, WeekRevenue> = {};
  for (const q of quotations) {
    const date = relevantDate(q);
    if (!date) continue;
    const week = getISOWeek(date);
    const w = (revenueByWeekRaw[week] ??= emptyWeekRevenue());

    if (q.status === 'accepted') {
      w.acceptedRevenue += q.revenueExVat;
      w.acceptedCount += 1;
      w.acceptedM2 += q.totalM2;
      if (q.margin !== null) {
        w.acceptedMargin += q.margin;
        w.acceptedMarginRev += q.revenueExVat;
      }
    } else if (q.status === 'open') {
      w.openRevenue += q.revenueExVat;
      w.openCount += 1;
    } else if (q.status === 'refused') {
      w.refusedRevenue += q.revenueExVat;
      w.refusedCount += 1;
    }
  }

  // ── Run time per week (keyed by closed_at) ──────────────────────────
  const runTimeByWeek: Record<string, WeekRunTime> = {};
  for (const r of runTimeRows) {
    if (!r.dateAccepted) continue;
    const week = getISOWeek(r.dateAccepted);
    const w = (runTimeByWeek[week] ??= { totalDays: 0, count: 0 });
    w.totalDays += r.runTimeDays;
    w.count += 1;
  }

  // ── Revenue per lead source (accepted only) ─────────────────────────
  const dealLeadSource: Record<string, string> = {};
  for (const r of runTimeRows) {
    if (r.dealId && r.leadSource) dealLeadSource[r.dealId] = r.leadSource;
  }

  const bySource: Record<string, { revenue: number; count: number; margin: number; marginRev: number }> = {};
  for (const q of quotations) {
    if (q.status !== 'accepted') continue;
    const sources = (dealLeadSource[q.dealId] || 'Onbekend').split(',').map((s) => s.trim());
    for (const src of sources) {
      const name = src || 'Onbekend';
      const e = (bySource[name] ??= { revenue: 0, count: 0, margin: 0, marginRev: 0 });
      e.revenue += q.revenueExVat;
      e.count += 1;
      if (q.margin !== null) {
        e.margin += q.margin;
        e.marginRev += q.revenueExVat;
      }
    }
  }

  // Run time per lead source (from won deals).
  const runBySource: Record<string, { days: number; count: number }> = {};
  for (const r of runTimeRows) {
    if (!r.leadSource) continue;
    for (const src of r.leadSource.split(',').map((s) => s.trim())) {
      const name = src || 'Onbekend';
      const e = (runBySource[name] ??= { days: 0, count: 0 });
      e.days += r.runTimeDays;
      e.count += 1;
    }
  }

  const leadSources: LeadSourceStat[] = Object.entries(bySource)
    .map(([name, d]) => {
      const rt = runBySource[name];
      return {
        name,
        revenue: round(d.revenue),
        count: d.count,
        marginPct: d.marginRev > 0 ? round((d.margin / d.marginRev) * 100, 1) : null,
        avgDealSize: d.count > 0 ? round(d.revenue / d.count) : 0,
        avgRunTimeDays: rt && rt.count > 0 ? round(rt.days / rt.count, 1) : null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // ── Revenue per region (accepted, by customer city) ─────────────────
  const byCity: Record<string, { revenue: number; count: number }> = {};
  for (const q of quotations) {
    if (q.status !== 'accepted') continue;
    const city = q.city?.trim() || 'Onbekend';
    const e = (byCity[city] ??= { revenue: 0, count: 0 });
    e.revenue += q.revenueExVat;
    e.count += 1;
  }
  const regions: RegionStat[] = Object.entries(byCity)
    .map(([name, d]) => ({ name, revenue: round(d.revenue), count: d.count }))
    .sort((a, b) => b.revenue - a.revenue);

  // ── Top products (accepted lines, by P-number / name) ───────────────
  const byProduct: Record<
    string,
    { revenue: number; m2: number; margin: number; priced: boolean; quotations: Set<string> }
  > = {};
  for (const line of productLines) {
    if (line.status !== 'accepted') continue;
    const e = (byProduct[line.code] ??= {
      revenue: 0,
      m2: 0,
      margin: 0,
      priced: false,
      quotations: new Set<string>(),
    });
    e.revenue += line.revenue;
    e.m2 += line.m2;
    if (line.margin !== null) {
      e.margin += line.margin;
      e.priced = true;
    }
    e.quotations.add(line.quotationId);
  }
  const topProducts: ProductStat[] = Object.entries(byProduct)
    .map(([code, e]) => ({
      code,
      revenue: round(e.revenue),
      m2: round(e.m2),
      margin: e.priced ? round(e.margin) : null,
      marginPct: e.priced && e.revenue > 0 ? round((e.margin / e.revenue) * 100, 1) : null,
      count: e.quotations.size,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // ── Weeks (union), descending ───────────────────────────────────────
  const weeks = [
    ...new Set([...Object.keys(revenueByWeekRaw), ...Object.keys(runTimeByWeek)]),
  ].sort(compareWeeksDesc);

  // ── Totals (from raw accumulators) ──────────────────────────────────
  let acceptedRevenue = 0;
  let openRevenue = 0;
  let refusedRevenue = 0;
  let acceptedCount = 0;
  let openCount = 0;
  let refusedCount = 0;
  let acceptedM2 = 0;
  let totalMargin = 0;
  let totalMarginRev = 0;
  for (const w of Object.values(revenueByWeekRaw)) {
    acceptedRevenue += w.acceptedRevenue;
    openRevenue += w.openRevenue;
    refusedRevenue += w.refusedRevenue;
    acceptedCount += w.acceptedCount;
    openCount += w.openCount;
    refusedCount += w.refusedCount;
    acceptedM2 += w.acceptedM2;
    totalMargin += w.acceptedMargin;
    totalMarginRev += w.acceptedMarginRev;
  }

  let totalRunDays = 0;
  let runCount = 0;
  for (const w of Object.values(runTimeByWeek)) {
    totalRunDays += w.totalDays;
    runCount += w.count;
  }

  const conversionPct =
    acceptedCount + refusedCount > 0
      ? round((acceptedCount / (acceptedCount + refusedCount)) * 100, 1)
      : 0;
  const avgRevenuePerDeal = acceptedCount > 0 ? round(acceptedRevenue / acceptedCount) : 0;
  const avgMarginPct = totalMarginRev > 0 ? round((totalMargin / totalMarginRev) * 100, 1) : 0;
  const avgRunTimeDays = runCount > 0 ? round(totalRunDays / runCount, 1) : 0;

  // ── Round byWeek money fields for clean output ──────────────────────
  const revenueByWeek: Record<string, WeekRevenue> = {};
  for (const [week, w] of Object.entries(revenueByWeekRaw)) {
    revenueByWeek[week] = {
      ...w,
      acceptedRevenue: round(w.acceptedRevenue),
      openRevenue: round(w.openRevenue),
      refusedRevenue: round(w.refusedRevenue),
      acceptedM2: round(w.acceptedM2),
      acceptedMargin: round(w.acceptedMargin),
      acceptedMarginRev: round(w.acceptedMarginRev),
    };
  }

  return {
    generatedAt,
    lookbackDays,
    weeks,
    revenue: {
      totals: {
        acceptedRevenue: round(acceptedRevenue),
        openRevenue: round(openRevenue),
        refusedRevenue: round(refusedRevenue),
        acceptedCount,
        openCount,
        refusedCount,
        conversionPct,
        avgRevenuePerDeal,
        m2Sold: round(acceptedM2),
        totalMargin: round(totalMargin),
        avgMarginPct,
      },
      byWeek: revenueByWeek,
    },
    runTime: {
      totals: { avgRunTimeDays, dealsTracked: runCount },
      byWeek: runTimeByWeek,
    },
    leadSources,
    regions,
    topProducts,
    invoicing,
    quotations,
    runTimeRows,
  };
}
