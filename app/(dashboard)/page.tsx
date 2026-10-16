'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { formatDays, formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { useDashboard } from '@/components/layout/DashboardProvider';
import ChartCard from '@/components/ChartCard';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import { buildKpiSeries } from '@/lib/kpi-series';
import LeadSourceDonut from '@/components/charts/LeadSourceDonut';
import RegionList from '@/components/charts/RegionList';
import EmptyState from '@/components/pages/EmptyState';
import { Card, Empty, SectionLabel, cn } from '@/components/ui';
import { perM2Stats } from '@/lib/insights';
import type { Granularity } from '@/lib/series';
import { deltaPct } from '@/lib/signal';
import { buildBriefing } from '@/lib/briefing';
import { CHART } from '@/components/charts/theme';
import Briefing from '@/components/overview/Briefing';
import MonthGoal from '@/components/overview/MonthGoal';
import { CalmDelta, Tile } from '@/components/overview/parts';

/**
 * Overzicht, van boven naar beneden in de volgorde waarin een eigenaar kijkt:
 *  1. wat speelt er en wie bel ik (de briefing);
 *  2. hoe staat de maand ervoor (het ene grote getal, tegen het doel);
 *  3. de gekozen periode in vier tegels, met daaronder de rest in één rij;
 *  4. de huidige stand van het geld;
 *  5. het verloop, en waar de omzet vandaan komt.
 * Kleur alleen waar het iets betekent; de pijltjes kleuren pas bij een groot
 * verschil op genoeg offertes (lib/signal.ts).
 */
export default function OverzichtPage() {
  const { snap, comparison, previous, range, aging, pipeline, adsDaily, openAtEnd, today, pricedCodes } = useDashboard();
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
    overdue: { amount: overdueAmount, count: aging.overdue.length },
  });
  const date = `${today.month.month}-${String(today.month.day).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      <div className="animate-rise-in">
        <Briefing zinnen={zinnen} callList={today.callList} date={date} pricedCodes={pricedCodes} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.35fr]">
        <MonthGoal month={today.month} />

        <section>
          <SectionLabel>Gekozen periode — offertes, ex btw</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <Tile
              label="Omzet geaccepteerd"
              value={formatEuro(totals.acceptedRevenue)}
              sub={`${totals.acceptedCount} offertes · ${formatEuro(totals.avgRevenuePerDeal)} gemiddeld`}
              delta={<CalmDelta pct={deltaPct(totals.acceptedRevenue, cmp?.acceptedRevenue)} label={deltaLabel} sample={sample} />}
              spark={spark('acceptedRevenue')}
              color={CHART.accepted}
            />
            <Tile
              label="Marge"
              value={formatEuro(totals.totalMargin)}
              sub={`${formatPercent(totals.avgMarginPct)} van de omzet`}
              delta={<CalmDelta pct={deltaPct(totals.totalMargin, cmp?.totalMargin)} label={deltaLabel} sample={sample} />}
              spark={spark('margin')}
              color={CHART.margin}
            />
            <Tile
              label="M² verkocht"
              value={formatNumber(totals.m2Sold)}
              sub={`${formatEuro(perM2.marginPerM2, true)} marge per m²`}
              delta={<CalmDelta pct={deltaPct(totals.m2Sold, cmp?.m2Sold)} label={deltaLabel} sample={sample} />}
              spark={spark('m2')}
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
                spark={spark('marginAfterAds')}
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
      </div>

      <Card>
        <div className="grid grid-cols-2 divide-hair lg:grid-cols-4 lg:divide-x [&>*]:border-hair max-lg:[&>*:nth-child(-n+2)]:border-b">
          <Stat
            label="Marge per m²"
            value={formatEuro(perM2.marginPerM2, true)}
            sub={`${formatEuro(perM2.revenuePerM2, true)} omzet − ${formatEuro(perM2.costPerM2, true)} kostprijs`}
            delta={<CalmDelta pct={deltaPct(perM2.marginPerM2, ref?.perM2?.marginPerM2)} label={deltaLabel} sample={sample} />}
          />
          <Stat
            label="Open offertes"
            value={formatEuro(openAtEnd.value)}
            sub={`${openAtEnd.count} offertes in de pijplijn`}
            delta={<CalmDelta pct={deltaPct(openAtEnd.value, ref?.openAtEnd?.value)} label="stapel vs eind periode ervoor" />}
          />
          <Stat
            label="Doorlooptijd"
            value={formatDays(snap.runTime.totals.avgRunTimeDays)}
            sub={`akkoord tot uitvoering · ${snap.runTime.totals.dealsTracked} deals`}
            delta={
              <CalmDelta
                pct={deltaPct(snap.runTime.totals.avgRunTimeDays, ref?.runTime.avgRunTimeDays)}
                label={deltaLabel}
                sample={snap.runTime.totals.dealsTracked}
                higherIsBetter={false}
              />
            }
          />
          <Stat
            label={showMarketing ? 'Marketingkosten' : 'Conversie'}
            value={showMarketing ? formatEuro(marketingCost) : formatPercent(totals.conversionPct)}
            sub={
              showMarketing
                ? metaCost > 0
                  ? `Google ${formatEuro(googleCost)} · Meta ${formatEuro(metaCost)}`
                  : 'Google Ads'
                : 'gewonnen van de beslisten'
            }
            delta={
              showMarketing ? (
                <CalmDelta pct={deltaPct(marketingCost, prevMarketingCost)} label={deltaLabel} higherIsBetter={false} />
              ) : null
            }
          />
        </div>
      </Card>

      <section>
        <SectionLabel
          right={
            <Link href="/cashflow" className="flex items-center gap-1 text-[11.5px] font-medium text-accent hover:underline">
              Naar cashflow <ArrowRight size={12} strokeWidth={2.2} />
            </Link>
          }
        >
          Geld — huidige stand
        </SectionLabel>
        <Card>
          <div className="grid grid-cols-2 lg:grid-cols-4 lg:divide-x [&>*]:border-hair max-lg:[&>*:nth-child(-n+2)]:border-b">
            <Stat
              label="Openstaand"
              value={formatEuro(aging.totalOutstanding)}
              sub={aging.overdue.length > 0 ? `${formatEuro(overdueAmount)} over de vervaldatum · incl. btw` : 'niets over de vervaldatum · incl. btw'}
              tone={aging.overdue.length > 0 ? 'crit' : undefined}
            />
            <Stat label="Gefactureerd" value={formatEuro(snap.invoicing.invoicedExcl)} sub={`${snap.invoicing.invoiceCount} facturen in de periode · ex btw`} />
            <Stat
              label="Betaald"
              value={formatEuro(snap.invoicing.paidExcl)}
              sub={`${formatPercent(snap.invoicing.invoicedExcl > 0 ? Math.round((snap.invoicing.paidExcl / snap.invoicing.invoicedExcl) * 1000) / 10 : null)} van gefactureerd`}
            />
            <Stat
              label="Verwacht uit pijplijn"
              value={pipeline.expectedValue == null ? '—' : formatEuro(pipeline.expectedValue)}
              sub={pipeline.winRate == null ? 'te weinig historie' : `${formatEuro(pipeline.openValue)} open × ${formatPercent(pipeline.winRate)} winkans`}
            />
          </div>
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title="Verloop"
          subtitle="Kies een vraag; euro's links, aantallen en procenten rechts"
          className="xl:col-span-2"
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
        <ChartCard title="Omzet per leadbron" subtitle="Geaccepteerde offertes">
          {snap.leadSources.length > 0 ? <LeadSourceDonut data={snap.leadSources} /> : <Empty>Geen data</Empty>}
        </ChartCard>
      </div>

      <ChartCard title="Omzet per regio" subtitle="Top plaatsen (geaccepteerd)">
        <RegionList data={snap.regions} />
      </ChartCard>
    </div>
  );
}

/** Eén cijfer in een strook: geen eigen kaart, dus geen muur van kaarten. */
function Stat({
  label,
  value,
  sub,
  delta,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: ReactNode;
  tone?: 'crit';
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium text-ink-mute">{label}</p>
        {delta}
      </div>
      <p className={cn('mt-1 text-[20px] font-semibold leading-tight tabular-nums', tone === 'crit' ? 'text-crit' : 'text-ink')}>{value}</p>
      {sub && <p className="mt-1 text-[11.5px] leading-snug text-ink-faint">{sub}</p>}
    </div>
  );
}
