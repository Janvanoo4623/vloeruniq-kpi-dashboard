'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';
import { useDashboard } from '@/components/layout/DashboardProvider';

/** Wat elke pagina toont zolang er nog nooit een snapshot is opgehaald. */
export default function EmptyState() {
  const { meta, refresh, refreshing } = useDashboard();

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
      <h2 className="text-[15px] font-semibold text-ink">Nog geen data</h2>
      <p className="mt-2 max-w-md text-[13px] text-ink-mute">
        Er is nog geen snapshot. Klik op vernieuwen om data uit Teamleader op te halen — dat duurt
        ongeveer één tot twee minuten.
      </p>
      {meta?.status === 'error' && meta.error && (
        <p className="mt-3 max-w-md text-[13px] text-crit">Laatste fout: {meta.error}</p>
      )}
      <Button variant="primary" onClick={refresh} disabled={refreshing} className="mt-6">
        <RefreshCw size={14} strokeWidth={2.2} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Bezig…' : 'Nu synchroniseren'}
      </Button>
    </div>
  );
}
