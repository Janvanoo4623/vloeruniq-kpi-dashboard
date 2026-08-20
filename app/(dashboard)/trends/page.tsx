'use client';

import { useDashboard } from '@/components/layout/DashboardProvider';
import TrendsView from '@/components/TrendsView';
import EmptyState from '@/components/pages/EmptyState';

/** De lange lijn: hoe de cijfers zich over weken en maanden bewegen. */
export default function TrendsPage() {
  const { snap } = useDashboard();
  if (!snap) return <EmptyState />;
  return <TrendsView snapshot={snap} />;
}
