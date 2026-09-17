// Server-only: alles wat het tabblad Marketing nodig heeft voor één periode,
// per platform én opgeteld. Gebruikt door de pagina (eerste weergave), /api/ads
// (bij het wisselen van periode) en het exportrapport — zodat die drie nooit
// iets anders zeggen.
import { getAdsRows, getAdsMeta, getAdsBudgets, getAppSetting, type AdsMeta } from './db';
import {
  adsTotals,
  adsByWeek,
  adsByCampaign,
  budgetStatus,
  monthsInRange,
  type AdsBudgets,
  type AdsCampaignStat,
  type AdsDailyRow,
  type AdsPlatform,
  type AdsTotals,
  type AdsWeekPoint,
  type MonthBudgetStatus,
} from './ads';

export const PLATFORMS: AdsPlatform[] = ['google', 'meta'];

export interface PlatformAds {
  platform: AdsPlatform;
  /** Is er een koppeling ingesteld (of staat er al data)? Zo niet: uitleg in plaats van nullen. */
  connected: boolean;
  totals: AdsTotals;
  prevTotals: AdsTotals | null;
  byWeek: AdsWeekPoint[];
  byCampaign: (AdsCampaignStat & { platform: AdsPlatform })[];
  budgets: MonthBudgetStatus[];
  rawBudgets: AdsBudgets;
  sync: AdsMeta | null;
}

export interface AdsPayload {
  /** False zolang de tabel ads_daily niet bestaat (migratie niet gedraaid). */
  available: boolean;
  range: { from: string; to: string };
  comparisonRange: { from: string; to: string } | null;
  /** Alle platforms samen. */
  total: { totals: AdsTotals; prevTotals: AdsTotals | null; byWeek: AdsWeekPoint[] };
  platforms: Record<AdsPlatform, PlatformAds>;
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

const onPlatform = (rows: AdsDailyRow[], p: AdsPlatform) => rows.filter((r) => r.platform === p);

export async function buildAdsPayload(from: string, to: string, compare = 'none'): Promise<AdsPayload> {
  const prev = comparisonRange(from, to, compare);
  const today = iso(Date.now());
  // Het budgetoverzicht kijkt naar de maanden van de periode, hooguit twaalf.
  const months = monthsInRange(from, to).slice(-12);
  const budgetFrom = `${months[0] ?? from.substring(0, 7)}-01`;

  const [rows, prevRows, budgetRows, googleSync, metaSync, googleBudgets, metaBudgets, gaql, metaCfg] = await Promise.all([
    getAdsRows(from, to),
    prev ? getAdsRows(prev.from, prev.to) : Promise.resolve<AdsDailyRow[] | null>([]),
    getAdsRows(budgetFrom, to),
    getAdsMeta('google'),
    getAdsMeta('meta').catch(() => null),
    getAdsBudgets('google'),
    getAdsBudgets('meta'),
    getAppSetting<{ token?: string } | null>('ads_gaql', null).catch(() => null),
    getAppSetting<{ token?: string } | null>('ads_meta', null).catch(() => null),
  ]);

  const available = rows !== null;
  const all = rows ?? [];
  const prevAll = prevRows ?? [];
  const budgetAll = budgetRows ?? [];

  const block = (p: AdsPlatform, sync: AdsMeta | null, rawBudgets: AdsBudgets, hasConfig: boolean): PlatformAds => {
    const r = onPlatform(all, p);
    return {
      platform: p,
      connected: hasConfig || r.length > 0 || Boolean(sync?.lastSyncAt),
      totals: adsTotals(r),
      prevTotals: prev ? adsTotals(onPlatform(prevAll, p)) : null,
      byWeek: adsByWeek(r, from, to),
      byCampaign: adsByCampaign(r).map((c) => ({ ...c, platform: p })),
      budgets: budgetStatus(onPlatform(budgetAll, p), rawBudgets, months, today),
      rawBudgets,
      sync,
    };
  };

  return {
    available,
    range: { from, to },
    comparisonRange: prev,
    total: {
      totals: adsTotals(all),
      prevTotals: prev ? adsTotals(prevAll) : null,
      byWeek: adsByWeek(all, from, to),
    },
    platforms: {
      google: block('google', googleSync, googleBudgets, Boolean(process.env.GAQL_TOKEN || gaql?.token)),
      meta: block('meta', metaSync, metaBudgets, Boolean((process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID) || metaCfg?.token)),
    },
  };
}
