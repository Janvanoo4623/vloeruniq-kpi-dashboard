// Shape the snapshot's weekly maps into chronological (ascending) arrays for charts.
import type { Snapshot } from './types';

export interface WeeklyPoint {
  week: string;
  acceptedRevenue: number;
  openRevenue: number;
  acceptedCount: number;
  openCount: number;
  refusedCount: number;
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
    const decided = acceptedCount + refusedCount;
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
      conversionPct,
      margin: r?.acceptedMargin ?? 0,
      marginPct,
      m2: r?.acceptedM2 ?? 0,
      avgRunTime: rt && rt.count > 0 ? Math.round((rt.totalDays / rt.count) * 10) / 10 : null,
      dealsTracked: rt?.count ?? 0,
    };
  });
}
