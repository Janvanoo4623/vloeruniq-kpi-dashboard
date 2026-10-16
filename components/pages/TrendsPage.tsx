'use client';

import { useDashboard } from '@/components/layout/DashboardProvider';
import TrendsView from '@/components/TrendsView';
import EmptyState from '@/components/pages/EmptyState';
import MarketPanel from '@/components/pages/MarketPanel';
import type { MarketData } from '@/lib/market';

/** De lange lijn: hoe de cijfers zich over weken en maanden bewegen, en de markt eromheen. */
export default function TrendsPage({ market }: { market: MarketData }) {
  const { snap, openStock } = useDashboard();
  if (!snap) return <EmptyState />;
  return (
    <div className="space-y-6">
      <TrendsView snapshot={snap} openStock={openStock} />
      <MarketPanel data={market} />
    </div>
  );
}
