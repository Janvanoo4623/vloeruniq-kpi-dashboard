'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { formatDays, formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { useDashboard } from '@/components/layout/DashboardProvider';
import KpiCard from '@/components/KpiCard';
import ChartCard from '@/components/ChartCard';
import RevenueByWeekChart from '@/components/charts/RevenueByWeekChart';
import LeadSourceDonut from '@/components/charts/LeadSourceDonut';
import RegionList from '@/components/charts/RegionList';
import EmptyState from '@/components/pages/EmptyState';
import { Empty, SectionLabel } from '@/components/ui';

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
  const { snap, comparison, range, aging, pipeline, series } = useDashboard();
  const totals = snap?.revenue.totals;
  if (!snap || !totals) return <EmptyState />;

  const cmp = comparison?.revenue;
  const show = comparison != null;
  const deltaLabel = range.compare === 'year' ? 'vs vorig jaar' : 'vs vorige periode';
  const marginPerM2 = totals.m2Sold > 0 ? totals.totalMargin / totals.m2Sold : null;
  const prevMarginPerM2 = cmp && cmp.m2Sold > 0 ? cmp.totalMargin / cmp.m2Sold : null;

  return (
    <div className="space-y-6">
      <section>
        <SectionLabel>In deze periode</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
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
            sub="per verkochte m²"
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
            deltaPct={show ? deltaPct(totals.openRevenue, cmp?.openRevenue) : null}
            deltaLabel={deltaLabel}
          />
          <KpiCard
            label="Gem. doorlooptijd"
            value={formatDays(snap.runTime.totals.avgRunTimeDays)}
            sub={`${formatNumber(snap.runTime.totals.dealsTracked)} deals gevolgd`}
            higherIsBetter={false}
            deltaPct={
              show ? deltaPct(snap.runTime.totals.avgRunTimeDays, comparison?.runTime.avgRunTimeDays) : null
            }
            deltaLabel={deltaLabel}
          />
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
            sub={`${snap.invoicing.invoiceCount} facturen`}
          />
          <KpiCard
            label="Betaald"
            value={formatEuro(snap.invoicing.paidExcl)}
            sub={`${formatPercent(
              snap.invoicing.invoicedExcl > 0
                ? Math.round((snap.invoicing.paidExcl / snap.invoicing.invoicedExcl) * 1000) / 10
                : null,
            )} van gefactureerd`}
          />
          <KpiCard
            label="Verwacht uit pijplijn"
            value={pipeline.expectedValue == null ? '—' : formatEuro(pipeline.expectedValue)}
            sub={
              pipeline.winRate == null
                ? 'te weinig historie voor een winkans'
                : `${formatEuro(pipeline.openValue)} open × ${formatPercent(pipeline.winRate)} winkans`
            }
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title="Omzet per week"
          subtitle="Geaccepteerd vs. open (ex. btw)"
          className="xl:col-span-2"
        >
          <RevenueByWeekChart data={series} />
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
