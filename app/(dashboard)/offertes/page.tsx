'use client';

import { useDashboard } from '@/components/layout/DashboardProvider';
import ChartCard from '@/components/ChartCard';
import QuotationsTable from '@/components/QuotationsTable';
import WeekOverviewTable from '@/components/WeekOverviewTable';
import EmptyState from '@/components/pages/EmptyState';

/** De volledige offertelijst; een rij aanklikken opent de detailweergave. */
export default function OffertesPage() {
  const { snap, pricedCodes } = useDashboard();
  if (!snap) return <EmptyState />;

  return (
    <div className="space-y-6">
      <ChartCard title="Offertes" subtitle="Alle offertes in de periode — klik een rij voor details">
        <QuotationsTable rows={snap.quotations} pricedCodes={pricedCodes} />
      </ChartCard>

      <ChartCard title="Weekoverzicht" subtitle="KPI's per week — nieuwste eerst">
        <WeekOverviewTable snapshot={snap} />
      </ChartCard>
    </div>
  );
}
