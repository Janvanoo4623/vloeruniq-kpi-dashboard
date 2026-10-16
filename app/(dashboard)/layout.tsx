import {
  getMeta,
  getAllInvoices,
  getAllQuotations,
  getCurrentPrices,
  getExclusions,
  getResolveInput,
  getAllDeals,
  getInvoiceAdjustments,
  getAppSetting,
  getAdsRows,
} from '@/lib/db';
import { getMoneybirdPL } from '@/lib/moneybird';
import { DEFAULT_START, START_KEY, invoicedByMonth } from '@/lib/resultaat';
import { EMPTY_GOALS, computeBreakEven, computeCallList, computeMonthProgress, computeTileTrends, type Goals } from '@/lib/today';
import { computeAging } from '@/lib/teamleader/invoices';
import { buildPeriodData } from '@/lib/period-data';
import { DEFAULT_PRESET, presetRangeServer } from '@/lib/default-range';
import { computePipeline } from '@/lib/pipeline';
import { computePaymentStats } from '@/lib/payments';
import { resolveQuotations } from '@/lib/resolve';
import DashboardProvider from '@/components/layout/DashboardProvider';
import AppShell from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';

/**
 * De data wordt hier één keer opgehaald voor élke pagina in de schil. Wisselen
 * van pagina kost daardoor geen nieuwe fetch, en de gekozen periode blijft staan.
 * Alle zware berekeningen blijven server-side; de client krijgt alleen resultaat.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [meta, invoices, quotations, prices, exclusions, resolveInput, deals, adjustments, pl, startMonth, goals] =
    await Promise.all([
      getMeta(),
      getAllInvoices(),
      getAllQuotations(),
      getCurrentPrices(),
      getExclusions(),
      getResolveInput(),
      getAllDeals(),
      getInvoiceAdjustments(),
      getMoneybirdPL(),
      getAppSetting<string>(START_KEY, DEFAULT_START).catch(() => DEFAULT_START),
      getAppSetting<Goals>('goals', EMPTY_GOALS).catch(() => EMPTY_GOALS),
    ]);

  const today = new Date().toISOString().split('T')[0];
  // Marges worden bij het lezen berekend uit de prijslijst en de kosten die op
  // de offertedatum golden, plus de handmatige correcties — zie lib/resolve.ts.
  const resolvedQuotations = resolveQuotations(quotations, resolveInput);

  // De eerste weergave wordt hier voor de standaardperiode berekend in plaats van
  // uit de gecachete snapshot te komen. Die snapshot dekt altijd het vaste
  // 90-daagse sync-venster, dus zodra de standaard iets anders is (30 dagen)
  // zegt de kop iets anders dan de grafiek eronder toont. Rekenen is hier
  // goedkoop: alle offertes staan er toch al voor de cashflow en de pijplijn.
  const { from, to } = presetRangeServer(DEFAULT_PRESET);
  const period = await buildPeriodData({
    quotations: resolvedQuotations,
    deals,
    invoices,
    exclusions,
    from,
    to,
    compare: 'none',
  });

  const aging = computeAging(invoices, today, resolvedQuotations, adjustments);
  const pipeline = computePipeline(resolvedQuotations, exclusions, today);
  const payments = computePaymentStats(invoices, today);
  const pricedCodes = prices.map((p) => p.code.toLowerCase());
  // Wat van de kalender afhangt, niet van de periodekiezer — zie lib/today.ts.
  // Een halfjaar plus vier weken advertentiekosten, voor de trendlijn van "marge na marketing".
  const adsSinds = new Date(Date.parse(today) - (26 * 7 + 28) * 86400000).toISOString().slice(0, 10);
  const adsVoorTrend = (await getAdsRows(adsSinds, today)) ?? [];
  const today_ = {
    trends: computeTileTrends(resolvedQuotations, exclusions, adsVoorTrend, today),
    callList: computeCallList(resolvedQuotations, exclusions, today),
    month: computeMonthProgress(resolvedQuotations, exclusions, today, { ...EMPTY_GOALS, ...goals }),
    breakEven: computeBreakEven(pl, invoicedByMonth(invoices), startMonth, today),
  };

  return (
    <DashboardProvider
      period={period}
      meta={meta}
      aging={aging}
      pipeline={pipeline}
      payments={payments}
      pricedCodes={pricedCodes}
      today={today_}
    >
      <AppShell>{children}</AppShell>
    </DashboardProvider>
  );
}
