'use client';

import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { useDashboard } from '@/components/layout/DashboardProvider';
import KpiCard from '@/components/KpiCard';
import ChartCard from '@/components/ChartCard';
import MarginTrendChart from '@/components/charts/MarginTrendChart';
import ProductsTable from '@/components/ProductsTable';
import AttentionTable from '@/components/AttentionTable';
import EmptyState from '@/components/pages/EmptyState';
import { SectionLabel } from '@/components/ui';

/** Alles over marge op één plek: de curve, per product, en waar het misgaat. */
export default function MargePage() {
  const { snap, series, pricedCodes } = useDashboard();
  const totals = snap?.revenue.totals;
  if (!snap || !totals) return <EmptyState />;

  const marginPerM2 = totals.m2Sold > 0 ? totals.totalMargin / totals.m2Sold : null;
  const revPerM2 = totals.m2Sold > 0 ? totals.acceptedRevenue / totals.m2Sold : null;
  const kostPerM2 = revPerM2 != null && marginPerM2 != null ? revPerM2 - marginPerM2 : null;

  return (
    <div className="space-y-6">
      <section>
        <SectionLabel>Per verkochte m²</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Totale marge" value={formatEuro(totals.totalMargin)} sub={`${formatPercent(totals.avgMarginPct)} gemiddeld`} accent="good" />
          <KpiCard label="Omzet / m²" value={formatEuro(revPerM2, true)} sub="geaccepteerd" accent="accent" />
          <KpiCard label="Kostprijs / m²" value={formatEuro(kostPerM2, true)} sub="inkoop + ondervloer + arbeid" accent="oak" higherIsBetter={false} />
          <KpiCard label="Marge / m²" value={formatEuro(marginPerM2, true)} sub={`over ${formatNumber(totals.m2Sold)} m²`} accent="good" />
        </div>
      </section>

      <ChartCard title="Marge per week" subtitle="Marge in € (staven) en % (lijn)">
        <MarginTrendChart data={series} />
      </ChartCard>

      <ChartCard title="Per vloerproduct" subtitle="Omzet, m² en marge per product">
        <ProductsTable rows={snap.topProducts} />
      </ChartCard>

      <ChartCard
        title="Aandachtspunten"
        subtitle="Laagste marges en offertes met onvolledige prijsdekking"
      >
        <AttentionTable rows={snap.quotations} pricedCodes={pricedCodes} />
      </ChartCard>
    </div>
  );
}
