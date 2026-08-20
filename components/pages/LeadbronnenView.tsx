'use client';

import { useDashboard } from '@/components/layout/DashboardProvider';
import ChartCard from '@/components/ChartCard';
import LeadSourceDonut from '@/components/charts/LeadSourceDonut';
import LeadSourceTable from '@/components/LeadSourceTable';
import RunTimeTrendChart from '@/components/charts/RunTimeTrendChart';
import EmptyState from '@/components/pages/EmptyState';
import LeadSourceTrendChart from '@/components/charts/LeadSourceTrendChart';
import type { LeadSourceTrend } from '@/lib/insights';
import { Empty } from '@/components/ui';

/** Waar de omzet vandaan komt, en wat elke bron daadwerkelijk oplevert. */
export default function LeadbronnenView({ trend }: { trend: LeadSourceTrend }) {
  const { snap, series } = useDashboard();
  if (!snap) return <EmptyState />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Omzet per leadbron" subtitle="Geaccepteerde offertes">
          {snap.leadSources.length > 0 ? <LeadSourceDonut data={snap.leadSources} /> : <Empty>Geen data</Empty>}
        </ChartCard>
        <ChartCard
          title="Doorlooptijd per week"
          subtitle="Gemiddelde looptijd van geaccepteerd tot uitvoering, in dagen"
          className="xl:col-span-2"
        >
          <RunTimeTrendChart data={series} />
        </ChartCard>
      </div>

      <ChartCard
        title="Verloop per leadbron"
        subtitle="Geaccepteerde omzet per maand — verschuift de mix, of groeit alles mee?"
      >
        <LeadSourceTrendChart data={trend} />
      </ChartCard>

      <ChartCard
        title="Leadbron-kwaliteit"
        subtitle="Omzet, dealgrootte, marge en doorlooptijd per bron"
      >
        <LeadSourceTable data={snap.leadSources} />
      </ChartCard>
    </div>
  );
}
