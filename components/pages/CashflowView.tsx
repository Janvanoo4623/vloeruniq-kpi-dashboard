'use client';

import { formatDays, formatEuro, formatPercent } from '@/lib/format';
import { useDashboard } from '@/components/layout/DashboardProvider';
import KpiCard from '@/components/KpiCard';
import KpiRow from '@/components/KpiRow';
import ChartCard from '@/components/ChartCard';
import CashflowCard from '@/components/CashflowCard';
import PaymentsCard from '@/components/PaymentsCard';
import EmptyState from '@/components/pages/EmptyState';
import QuotedVsInvoicedPanel from '@/components/pages/QuotedVsInvoicedPanel';
import type { QuotedVsInvoiced } from '@/lib/customers';
import { SectionLabel } from '@/components/ui';
import CashForecastPanel from '@/components/pages/CashForecastPanel';
import type { CashForecast } from '@/lib/cash-forecast';

/** Openstaand geld en betaalgedrag. Altijd de huidige stand, niet de periode. */
export default function CashflowView({
  quotedVsInvoiced,
  forecast,
}: {
  quotedVsInvoiced: QuotedVsInvoiced;
  forecast: CashForecast;
}) {
  const { snap, aging, payments, pricedCodes } = useDashboard();
  if (!snap) return <EmptyState />;

  return (
    <div className="space-y-6">
      {forecast.available && <CashForecastPanel forecast={forecast} />}

      <section>
        <SectionLabel>Huidige stand — bedragen incl. btw</SectionLabel>
        <KpiRow>
          <KpiCard
            label="Openstaand"
            value={formatEuro(aging.totalOutstanding)}
            sub={`${payments.outstandingCount} onbetaalde facturen`}
          />
          <KpiCard
            label="Over de vervaldatum"
            value={formatEuro(aging.overdue.reduce((s, o) => s + o.amount, 0))}
            sub={`${aging.overdue.length} facturen`}
            higherIsBetter={false}
            signal={aging.overdue.length > 0 ? 'crit' : 'good'}
          />
          <KpiCard
            label="Gem. betaaltermijn"
            value={formatDays(payments.avgDaysToPay)}
            sub={payments.sampleCount > 0 ? `over ${payments.sampleCount} betaalde facturen` : 'nog geen betaaldata'}
            higherIsBetter={false}
          />
          <KpiCard
            label="Op tijd betaald"
            value={formatPercent(payments.onTimePct)}
            sub="op of vóór de vervaldatum"
          />
        </KpiRow>
      </section>

      <QuotedVsInvoicedPanel data={quotedVsInvoiced} />

      <ChartCard
        title="Openstaand naar ouderdom"
        subtitle="Onbetaalde facturen ten opzichte van hun vervaldatum"
      >
        <CashflowCard
          buckets={aging.buckets}
          overdue={aging.overdue}
          totalOutstanding={aging.totalOutstanding}
          pricedCodes={pricedCodes}
        />
      </ChartCard>

      <ChartCard title="Betaalgedrag" subtitle="Hoe snel klanten betalen, op basis van de betaaldatum">
        <PaymentsCard payments={payments} />
      </ChartCard>
    </div>
  );
}
