// Server-only: alles wat het tabblad Marketing nodig heeft voor één periode,
// in één object. Gebruikt door de pagina (eerste weergave), /api/ads (bij het
// wisselen van periode) en het exportrapport — zodat die drie nooit iets anders
// zeggen.
import { getAdsRows, getAdsMeta, getAdsBudgets, type AdsMeta } from './db';
import {
  adsTotals,
  adsByWeek,
  adsByCampaign,
  budgetStatus,
  monthsInRange,
  type AdsBudgets,
  type AdsCampaignStat,
  type AdsDailyRow,
  type AdsTotals,
  type AdsWeekPoint,
  type MonthBudgetStatus,
} from './ads';

export interface AdsPayload {
  /** False zolang de tabel ads_daily niet bestaat (migratie niet gedraaid). */
  available: boolean;
  range: { from: string; to: string };
  totals: AdsTotals;
  byWeek: AdsWeekPoint[];
  byCampaign: AdsCampaignStat[];
  comparison: { from: string; to: string; totals: AdsTotals } | null;
  budgets: MonthBudgetStatus[];
  rawBudgets: AdsBudgets;
  meta: AdsMeta | null;
}

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().split('T')[0];

function shiftYear(date: string, years: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().split('T')[0];
}

/** Dezelfde vergelijkingsregel als /api/data — anders vergelijk je appels met peren. */
export function comparisonRange(from: string, to: string, compare: string): { from: string; to: string } | null {
  if (compare === 'year') return { from: shiftYear(from, -1), to: shiftYear(to, -1) };
  if (compare === 'previous') {
    const lenDays = Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
    const prevTo = iso(Date.parse(from) - DAY);
    return { from: iso(Date.parse(prevTo) - (lenDays - 1) * DAY), to: prevTo };
  }
  return null;
}

export async function buildAdsPayload(from: string, to: string, compare = 'none'): Promise<AdsPayload> {
  const prev = comparisonRange(from, to, compare);
  const today = iso(Date.now());
  // Het budgetoverzicht kijkt altijd naar de maanden van de periode, maar
  // hooguit twaalf terug — bij 'Alles' wil je geen 22 maanden budgetregels.
  const months = monthsInRange(from, to).slice(-12);
  const budgetFrom = `${months[0] ?? from.substring(0, 7)}-01`;

  const [rows, prevRows, budgetRows, meta, rawBudgets] = await Promise.all([
    getAdsRows(from, to),
    prev ? getAdsRows(prev.from, prev.to) : Promise.resolve<AdsDailyRow[] | null>([]),
    getAdsRows(budgetFrom, to),
    getAdsMeta(),
    getAdsBudgets(),
  ]);

  if (rows === null) {
    return {
      available: false,
      range: { from, to },
      totals: adsTotals([]),
      byWeek: [],
      byCampaign: [],
      comparison: null,
      budgets: [],
      rawBudgets,
      meta: null,
    };
  }

  return {
    available: true,
    range: { from, to },
    totals: adsTotals(rows),
    byWeek: adsByWeek(rows, from, to),
    byCampaign: adsByCampaign(rows),
    comparison: prev ? { ...prev, totals: adsTotals(prevRows ?? []) } : null,
    budgets: budgetStatus(budgetRows ?? [], rawBudgets, months, today),
    rawBudgets,
    meta,
  };
}
