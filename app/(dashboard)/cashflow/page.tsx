'use client';

import { formatDays, formatEuro, formatPercent } from '@/lib/format';
import { useDashboard } from '@/components/layout/DashboardProvider';
import KpiCard from '@/components/KpiCard';
import ChartCard from '@/components/ChartCard';
import CashflowCard from '@/components/CashflowCard';
import PaymentsCard from '@/components/PaymentsCard';
import EmptyState from '@/components/pages/EmptyState';
import { SectionLabel } from '@/components/ui';

/** Openstaand geld en betaalgedrag. Altijd de huidige stand, niet de periode. */
export default function CashflowPage() {
  const { snap, aging, payments, pricedCodes } = useDashboard();
  if (!snap) return <EmptyState />;

  return (
    <div className="space-y-6">
      <section>
        <SectionLabel>Huidige stand — bedragen incl. btw</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Openstaand"
            value={formatEuro(aging.totalOutstanding)}
            sub={`${payments.outstandingCount} onbetaalde facturen`}
            accent={aging.overdue.length > 0 ? 'crit' : 'neutral'}
          />
          <KpiCard
            label="Over de vervaldatum"
            value={formatEuro(aging.overdue.reduce((s, o) => s + o.amount, 0))}
            sub={`${aging.overdue.length} facturen`}
            accent={aging.overdue.length > 0 ? 'crit' : 'good'}
            higherIsBetter={false}
          />
          <KpiCard
            label="Gem. betaaltermijn"
            value={formatDays(payments.avgDaysToPay)}
            sub={payments.sampleCount > 0 ? `over ${payments.sampleCount} betaalde facturen` : 'nog geen betaaldata'}
            accent="accent"
            higherIsBetter={false}
          />
          <KpiCard
            label="Op tijd betaald"
            value={formatPercent(payments.onTimePct)}
            sub="op of vóór de vervaldatum"
            accent="good"
          />
        </div>
      </section>

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
