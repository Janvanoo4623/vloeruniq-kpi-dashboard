'use client';

import { useMemo, useState } from 'react';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { useDashboard } from '@/components/layout/DashboardProvider';
import ChartCard from '@/components/ChartCard';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import { buildKpiSeries } from '@/lib/kpi-series';
import EmptyState from '@/components/pages/EmptyState';
import { SectionLabel, cn } from '@/components/ui';
import { perM2Stats } from '@/lib/insights';
import type { Granularity } from '@/lib/series';
import { deltaPct } from '@/lib/signal';
import { buildBriefing } from '@/lib/briefing';
import { CHART } from '@/components/charts/theme';
import Briefing from '@/components/overview/Briefing';
import MonthGoal from '@/components/overview/MonthGoal';
import { CalmDelta, Tile } from '@/components/overview/parts';

/**
 * Overzicht: drie lagen, elk met één vraag.
 *  1. Wat speelt er, hoe loopt de maand, wie bel ik? (de briefing)
 *  2. Hoe deed de gekozen periode het? (vier tegels)
 *  3. Hoe beweegt het over tijd? (het verloop)
 * Alles wat een eigen pagina heeft — geld, leadbronnen, regio — staat daar en
 * niet hier; Overzicht moet zeggen waar je moet kijken, niet alles tegelijk
 * laten zien. Kleur alleen waar het iets betekent (lib/signal.ts).
 */
export default function OverzichtPage() {
  const { snap, comparison, previous, range, aging, adsDaily, today, pricedCodes, meta } = useDashboard();
  const [gran, setGran] = useState<Granularity | null>(null);
  const granularity: Granularity = gran ?? ((snap?.weeks.length ?? 0) > 16 ? 'month' : 'week');
  const kpiSeries = useMemo(
    () => (snap ? buildKpiSeries(snap, adsDaily, granularity) : []),
    [snap, adsDaily, granularity],
  );
  // Sparklines altijd per week: per maand zijn het er over 30 dagen maar twee.
  const weekly = useMemo(() => (snap ? buildKpiSeries(snap, adsDaily, 'week') : []), [snap, adsDaily]);
  const totals = snap?.revenue.totals;
  if (!snap || !totals) return <EmptyState />;

  const ref = range.compare === 'year' ? comparison : (previous ?? comparison);
  const cmp = ref?.revenue;
  const deltaLabel = range.compare === 'year' ? 'vs vorig jaar' : 'vs periode ervoor';
  const sample = Math.min(totals.acceptedCount, cmp?.acceptedCount ?? 0);
  const perM2 = perM2Stats(snap.quotations);

  const googleCost = adsDaily.reduce((t, d) => t + d.cost, 0);
  const metaCost = adsDaily.reduce((t, d) => t + (d.metaCost ?? 0), 0);
  const marketingCost = googleCost + metaCost;
  const prevMarketingCost = ref?.adsCost ? ref.adsCost.google + ref.adsCost.meta : null;
  const showMarketing = marketingCost > 0 || (prevMarketingCost ?? 0) > 0;

  const spark = (key: string) => weekly.map((p) => Number(p[key] ?? 0));

  const overdueAmount = aging.overdue.reduce((s, o) => s + o.amount, 0);
  const zinnen = buildBriefing({
    month: today.month,
    breakEven: today.breakEven,
    marginPct: totals.avgMarginPct,
    prevMarginPct: cmp?.avgMarginPct ?? null,
    overdue: { amount: overdueAmount, count: aging.overdue.length, outstanding: aging.totalOutstanding },
  });
  const date = `${today.month.month}-${String(today.month.day).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      <div className="animate-rise-in">
        <Briefing
          // De maand zelf staat in het blok eronder; de zinnen gaan over de rest.
          zinnen={zinnen.filter((z) => !['up', 'down', 'flat', 'goal'].includes(z.kind))}
          callList={today.callList}
          date={date}
          lastSyncAt={meta?.lastSyncAt ?? null}
          pricedCodes={pricedCodes}
        >
          <MonthGoal month={today.month} />
        </Briefing>
      </div>

      <section>
        <SectionLabel right={<span className="text-[11px] text-ink-faint">lijnen: lopende 4 weken, laatste halfjaar</span>}>
          Gekozen periode — offertes, ex btw
        </SectionLabel>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Tile
            label="Omzet geaccepteerd"
            value={formatEuro(totals.acceptedRevenue)}
            sub={`${totals.acceptedCount} offertes · ${formatEuro(totals.avgRevenuePerDeal)} gemiddeld`}
            delta={<CalmDelta pct={deltaPct(totals.acceptedRevenue, cmp?.acceptedRevenue)} label={deltaLabel} sample={sample} />}
            spark={today.trends.revenue}
            color={CHART.accepted}
          />
          <Tile
            label="Marge"
            value={formatEuro(totals.totalMargin)}
            sub={`${formatPercent(totals.avgMarginPct)} van de omzet`}
            delta={<CalmDelta pct={deltaPct(totals.totalMargin, cmp?.totalMargin)} label={deltaLabel} sample={sample} />}
            spark={today.trends.margin}
            color={CHART.margin}
          />
          <Tile
            label="M² verkocht"
            value={formatNumber(totals.m2Sold)}
            sub={`${formatEuro(perM2.marginPerM2, true)} marge per m²`}
            delta={<CalmDelta pct={deltaPct(totals.m2Sold, cmp?.m2Sold)} label={deltaLabel} sample={sample} />}
            spark={today.trends.m2}
            color={CHART.open}
          />
          {showMarketing ? (
            <Tile
              label="Marge na marketing"
              value={formatEuro(totals.totalMargin - marketingCost)}
              sub={`${formatEuro(marketingCost)} aan advertenties`}
              delta={
                <CalmDelta
                  pct={cmp && prevMarketingCost != null ? deltaPct(totals.totalMargin - marketingCost, cmp.totalMargin - prevMarketingCost) : null}
                  label={deltaLabel}
                  sample={sample}
                />
              }
              spark={today.trends.marginAfterAds}
              color={CHART.adsConversions}
            />
          ) : (
            <Tile
              label="Conversie"
              value={formatPercent(totals.conversionPct)}
              sub="gewonnen van de beslisten"
              delta={<CalmDelta pct={deltaPct(totals.conversionPct, cmp?.conversionPct)} label={deltaLabel} sample={sample} />}
              spark={spark('conversionPct')}
              color={CHART.accepted}
            />
          )}
        </div>
      </section>

      <ChartCard
        title="Verloop"
        subtitle="Kies een vraag; euro's links, aantallen en procenten rechts"
        action={
          <div className="flex rounded-lg border border-line bg-surface p-0.5 text-[11.5px]">
            {(['week', 'month'] as Granularity[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGran(g)}
                className={cn('rounded-md px-2.5 py-1 font-medium transition', granularity === g ? 'bg-ink text-white' : 'text-ink-mute hover:text-ink')}
              >
                {g === 'week' ? 'Week' : 'Maand'}
              </button>
            ))}
          </div>
        }
      >
        <KpiTrendChart data={kpiSeries} />
      </ChartCard>
    </div>
  );
}
