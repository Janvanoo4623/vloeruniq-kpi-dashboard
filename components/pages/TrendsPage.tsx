'use client';

import { useMemo, useState } from 'react';
import { useDashboard } from '@/components/layout/DashboardProvider';
import TrendsView from '@/components/TrendsView';
import EmptyState from '@/components/pages/EmptyState';
import MarketPanel from '@/components/pages/MarketPanel';
import ChartCard from '@/components/ChartCard';
import KpiTrendChart from '@/components/charts/KpiTrendChart';
import { buildKpiSeries } from '@/lib/kpi-series';
import type { Granularity } from '@/lib/series';
import type { MarketData } from '@/lib/market';
import { cn } from '@/components/ui';

/**
 * De lange lijn: hoe de cijfers zich over weken en maanden bewegen, en de markt
 * eromheen. Sinds 2026-10-19 staat hier ook de grafiek waarin je zelf KPI's
 * aanvinkt — hij stond op Overzicht, maar daar is nu één rustige grafiek.
 */
export default function TrendsPage({ market }: { market: MarketData }) {
  const { snap, openStock, adsDaily } = useDashboard();
  const [gran, setGran] = useState<Granularity | null>(null);
  const granularity: Granularity = gran ?? ((snap?.weeks.length ?? 0) > 16 ? 'month' : 'week');
  const kpiSeries = useMemo(() => (snap ? buildKpiSeries(snap, adsDaily, granularity) : []), [snap, adsDaily, granularity]);
  if (!snap) return <EmptyState />;
  return (
    <div className="space-y-6">
      <ChartCard
        title="KPI's naast elkaar"
        subtitle="Kies een vraag of stel zelf samen; euro's links, aantallen en procenten rechts"
        action={
          <div className="flex rounded-full bg-sunk p-1 text-[11.5px]">
            {(['week', 'month'] as Granularity[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGran(g)}
                className={cn('rounded-full px-2.5 py-1 font-medium transition', granularity === g ? 'bg-night text-white shadow-sm' : 'text-ink-mute hover:text-ink')}
              >
                {g === 'week' ? 'Week' : 'Maand'}
              </button>
            ))}
          </div>
        }
      >
        <KpiTrendChart data={kpiSeries} />
      </ChartCard>
      <TrendsView snapshot={snap} openStock={openStock} />
      <MarketPanel data={market} />
    </div>
  );
}
