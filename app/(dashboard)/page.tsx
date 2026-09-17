'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { formatDays, formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { useDashboard } from '@/components/layout/DashboardProvider';
import KpiCard from '@/components/KpiCard';
import ChartCard from '@/components/ChartCard';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import { buildKpiSeries } from '@/lib/kpi-series';
import LeadSourceDonut from '@/components/charts/LeadSourceDonut';
import RegionList from '@/components/charts/RegionList';
import EmptyState from '@/components/pages/EmptyState';
import { Empty, SectionLabel } from '@/components/ui';
import { perM2Stats } from '@/lib/insights';
import type { Granularity } from '@/lib/series';
import { cn } from '@/components/ui';

function deltaPct(cur: number, prev: number | undefined | null): number | null {
  if (prev == null || prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

/**
 * Overzicht: de zes cijfers die er dagelijks toe doen, de omzetcurve, en waar de
 * omzet vandaan komt. Alles wat verdieping is heeft een eigen pagina — deze moet
 * op één scherm passen.
 */
export default function OverzichtPage() {
  const { snap, comparison, previous, range, aging, pipeline, adsDaily, openAtEnd } = useDashboard();
  // Per week zolang het overzichtelijk blijft, anders per maand; omschakelbaar.
  const [gran, setGran] = useState<Granularity | null>(null);
  const granularity: Granularity = gran ?? ((snap?.weeks.length ?? 0) > 16 ? 'month' : 'week');
  const kpiSeries = useMemo(
    () => (snap ? buildKpiSeries(snap, adsDaily, granularity) : []),
    [snap, adsDaily, granularity],
  );
  const totals = snap?.revenue.totals;
  if (!snap || !totals) return <EmptyState />;

  // De pijltjes vergelijken altijd met de even lange periode ervoor (30 dagen
  // tegenover de 30 dagen daarvoor), ook zonder dat je 'vergelijken' aanzet.
  // Kies je 'vorig jaar', dan wint die keuze.
  const ref = range.compare === 'year' ? comparison : (previous ?? comparison);
  const cmp = ref?.revenue;
  const show = ref != null;
  const deltaLabel = range.compare === 'year' ? 'vs vorig jaar' : 'vs periode ervoor';
  // Marge per m² komt uit de vloerregels zelf. Uit de totalen delen ging mis:
  // de marge telt alleen offertes mét inkoopprijs, de m² tellen ze allemaal.
  const perM2 = perM2Stats(snap.quotations);
  const marginPerM2 = perM2.marginPerM2;
  const prevMarginPerM2 = ref?.perM2?.marginPerM2 ?? null;

  // Marketingkosten over alle kanalen. De kaart verschijnt pas als er ooit
  // advertentiedata is, anders staat er een nul die niets betekent.
  const googleCost = adsDaily.reduce((t, d) => t + d.cost, 0);
  const metaCost = adsDaily.reduce((t, d) => t + (d.metaCost ?? 0), 0);
  const marketingCost = googleCost + metaCost;
  const prevMarketingCost = ref?.adsCost ? ref.adsCost.google + ref.adsCost.meta : null;
  const showMarketing = marketingCost > 0 || (prevMarketingCost ?? 0) > 0;

  return (
    <div className="space-y-6">
      <section>
        <SectionLabel>In deze periode — offertebedragen ex btw</SectionLabel>
        {/* Met marketing erbij acht kaarten: twee rijen van vier. Zeven op een rij
            was te krap, de pijltjes vielen van de kaart af. */}
        <div className={cn('grid grid-cols-2 gap-3', showMarketing ? 'lg:grid-cols-4' : 'lg:grid-cols-3 xl:grid-cols-6')}>
          <KpiCard
            label="Omzet geaccepteerd"
            value={formatEuro(totals.acceptedRevenue)}
            sub={`${totals.acceptedCount} offertes`}
            deltaPct={show ? deltaPct(totals.acceptedRevenue, cmp?.acceptedRevenue) : null}
            deltaLabel={deltaLabel}
          />
          <KpiCard
            label="Totale marge"
            value={formatEuro(totals.totalMargin)}
            sub={`${formatPercent(totals.avgMarginPct)} gemiddeld`}
            deltaPct={show ? deltaPct(totals.totalMargin, cmp?.totalMargin) : null}
            deltaLabel={deltaLabel}
          />
          <KpiCard
            label="Marge / m²"
            value={formatEuro(marginPerM2, true)}
            sub="op vloerregels, ex btw"
            deltaPct={show ? deltaPct(marginPerM2 ?? 0, prevMarginPerM2) : null}
            deltaLabel={deltaLabel}
          />
          <KpiCard
            label="M² verkocht"
            value={formatNumber(totals.m2Sold)}
            sub={`${formatEuro(totals.avgRevenuePerDeal)} gem. per deal`}
            deltaPct={show ? deltaPct(totals.m2Sold, cmp?.m2Sold) : null}
            deltaLabel={deltaLabel}
          />
          <KpiCard
            label="Omzet open"
            value={formatEuro(totals.openRevenue)}
            sub={`${totals.openCount} offertes in de pijplijn`}
            // 'Open' is een momentopname: vergelijk de stapel aan het eind van
            // de periode met die aan het eind van de periode ervoor.
            deltaPct={show ? deltaPct(openAtEnd.value, ref?.openAtEnd?.value) : null}
            deltaLabel={range.compare === 'year' ? 'stapel vs eind vorig jaar' : 'stapel vs eind periode ervoor'}
          />
          <KpiCard
            label="Gem. doorlooptijd"
            value={formatDays(snap.runTime.totals.avgRunTimeDays)}
            sub={`${formatNumber(snap.runTime.totals.dealsTracked)} deals gevolgd`}
            higherIsBetter={false}
            deltaPct={
              show ? deltaPct(snap.runTime.totals.avgRunTimeDays, ref?.runTime.avgRunTimeDays) : null
            }
            deltaLabel={deltaLabel}
          />
          {showMarketing && (
            <KpiCard
              label="Marketingkosten"
              value={formatEuro(marketingCost)}
              sub={
                metaCost > 0
                  ? `Google ${formatEuro(googleCost)} · Meta ${formatEuro(metaCost)}`
                  : `Google Ads · ${formatPercent(totals.totalMargin > 0 ? Math.round((marketingCost / totals.totalMargin) * 1000) / 10 : null)} van de marge`
              }
              higherIsBetter={false}
              deltaPct={show && prevMarketingCost != null ? deltaPct(marketingCost, prevMarketingCost) : null}
              deltaLabel={deltaLabel}
            />
          )}
          {showMarketing && (
            <KpiCard
              label="Marge na marketing"
              value={formatEuro(totals.totalMargin - marketingCost)}
              sub="totale marge min advertentiekosten"
              deltaPct={
                show && cmp && prevMarketingCost != null
                  ? deltaPct(totals.totalMargin - marketingCost, cmp.totalMargin - prevMarketingCost)
                  : null
              }
              deltaLabel={deltaLabel}
            />
          )}
        </div>
      </section>

      <section>
        <SectionLabel
          right={
            <Link
              href="/cashflow"
              className="flex items-center gap-1 text-[11.5px] font-medium text-accent hover:underline"
            >
              Naar cashflow <ArrowRight size={12} strokeWidth={2.2} />
            </Link>
          }
        >
          Huidige stand — niet periode-gebonden
        </SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Openstaand"
            value={formatEuro(aging.totalOutstanding)}
            sub={`${aging.overdue.length} facturen over de vervaldatum · incl. btw`}
            // Alleen rood als er daadwerkelijk iets over de vervaldatum staat.
            signal={aging.overdue.length > 0 ? 'crit' : undefined}
          />
          <KpiCard
            label="Gefactureerd"
            value={formatEuro(snap.invoicing.invoicedExcl)}
            sub={`${snap.invoicing.invoiceCount} facturen · ex btw`}
          />
          <KpiCard
            label="Betaald"
            value={formatEuro(snap.invoicing.paidExcl)}
            sub={`${formatPercent(
              snap.invoicing.invoicedExcl > 0
                ? Math.round((snap.invoicing.paidExcl / snap.invoicing.invoicedExcl) * 1000) / 10
                : null,
            )} van gefactureerd · ex btw`}
          />
          <KpiCard
            label="Verwacht uit pijplijn"
            value={pipeline.expectedValue == null ? '—' : formatEuro(pipeline.expectedValue)}
            sub={
              pipeline.winRate == null
                ? 'te weinig historie voor een winkans'
                : `${formatEuro(pipeline.openValue)} open × ${formatPercent(pipeline.winRate)} winkans · ex btw`
            }
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title="Verloop"
          subtitle="Kies wat je wilt zien; euro's links, aantallen en procenten rechts"
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
          {snap.leadSources.length > 0 ? (
            <LeadSourceDonut data={snap.leadSources} />
          ) : (
            <Empty>Geen data</Empty>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Omzet per regio" subtitle="Top plaatsen (geaccepteerd)">
        <RegionList data={snap.regions} />
      </ChartCard>
    </div>
  );
}
