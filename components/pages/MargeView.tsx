'use client';

import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { useDashboard } from '@/components/layout/DashboardProvider';
import KpiCard from '@/components/KpiCard';
import ChartCard from '@/components/ChartCard';
import MarginTrendChart from '@/components/charts/MarginTrendChart';
import ProductsTable from '@/components/ProductsTable';
import AttentionTable from '@/components/AttentionTable';
import EmptyState from '@/components/pages/EmptyState';
import InstallMixPanel from '@/components/pages/InstallMixPanel';
import { perM2Stats } from '@/lib/insights';
import type { InstallMixPoint, InstallModeStat, ProductSpread } from '@/lib/insights';
import ProductSpreadPanel from '@/components/pages/ProductSpreadPanel';
import { SectionLabel } from '@/components/ui';

/** Alles over marge op één plek: de curve, per product, en waar het misgaat. */
export default function MargeView({
  installTotals,
  installByQuarter,
  spread,
}: {
  installTotals: InstallModeStat[];
  installByQuarter: InstallMixPoint[];
  spread: ProductSpread[];
}) {
  const { snap, series, pricedCodes } = useDashboard();
  const totals = snap?.revenue.totals;
  if (!snap || !totals) return <EmptyState />;

  // Alles per m² komt uit de vloerregels van de gekozen periode, niet uit de
  // snapshot-totalen: die deelden de héle offerte-omzet door alleen vloer-m².
  const perM2 = perM2Stats(snap.quotations);
  const dekking = perM2.m2Total > 0 ? (perM2.m2Priced / perM2.m2Total) * 100 : null;

  return (
    <div className="space-y-6">
      <section>
        <SectionLabel>Per verkochte m² — vloerregels, ex btw</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Totale marge"
            value={formatEuro(totals.totalMargin)}
            sub={`${formatPercent(totals.avgMarginPct)} gemiddeld`}
          />
          <KpiCard
            label="Omzet / m²"
            value={formatEuro(perM2.revenuePerM2, true)}
            sub="wat de vloer opbrengt"
          />
          <KpiCard
            label="Kostprijs / m²"
            value={formatEuro(perM2.costPerM2, true)}
            sub={`${formatEuro(perM2.purchasePerM2, true)} inkoop + ${formatEuro(perM2.underlayPerM2, true)} ondervloer + ${formatEuro(perM2.laborPerM2, true)} arbeid`}
            higherIsBetter={false}
          />
          <KpiCard
            label="Marge / m²"
            value={formatEuro(perM2.marginPerM2, true)}
            sub={`${formatPercent(perM2.marginPct)} van de vloeromzet`}
          />
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
          Gerekend over {formatNumber(perM2.m2Priced)} van de {formatNumber(perM2.m2Total)} verkochte m²
          {dekking != null && ` (${formatPercent(dekking)})`} — de rest heeft nog geen inkoopprijs en
          telt hier dus niet mee. Vul die aan op{' '}
          <a href="/controleren" className="underline decoration-hair underline-offset-2 hover:text-ink-soft">
            Controleren
          </a>
          .
        </p>
      </section>

      <ChartCard title="Marge per week" subtitle="Marge in € (staven) en % (lijn)">
        <MarginTrendChart data={series} />
      </ChartCard>

      <InstallMixPanel totals={installTotals} byQuarter={installByQuarter} />

      <ChartCard title="Per vloerproduct" subtitle="Omzet, m² en marge per product">
        <ProductsTable rows={snap.topProducts} />
      </ChartCard>

      <ProductSpreadPanel products={spread} />

      <ChartCard
        title="Aandachtspunten"
        subtitle="Waar je te weinig verdient, en waar de prijsdekking onvolledig is — ontbrekende inkoopprijzen staan op Controleren"
      >
        <AttentionTable rows={snap.quotations} pricedCodes={pricedCodes} />
      </ChartCard>
    </div>
  );
}
