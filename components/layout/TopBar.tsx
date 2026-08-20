'use client';

import { usePathname, useRouter } from 'next/navigation';
import { LogOut, RefreshCw } from 'lucide-react';
import { navItemFor } from '@/lib/nav';
import { formatDateTime, timeAgo } from '@/lib/format';
import DateRangePicker from '@/components/DateRangePicker';
import { Button } from '@/components/ui';
import { useDashboard } from './DashboardProvider';

/**
 * Vaste kop boven elke pagina: waar je bent (links) en waarmee je stuurt
 * (rechts). De periodekiezer staat hier één keer in plaats van per pagina, zodat
 * hij bij het wisselen van pagina blijft staan.
 */
export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { range, setRange, dataLoading, refresh, refreshing, meta } = useDashboard();
  const item = navItemFor(pathname);

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      <div className="flex h-[68px] items-center gap-4 px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-bold tracking-tight text-ink">
            {item?.title ?? 'Vloeruniq'}
          </h1>
          <p className="mt-0.5 truncate text-[11.5px] text-ink-mute">
            {item?.subtitle ?? 'KPI-dashboard'}
          </p>
        </div>

        <DateRangePicker value={range} onChange={setRange} loading={dataLoading} />

        <div className="hidden text-right lg:block">
          <p className="text-[10px] leading-none text-ink-faint">Laatst gesynct</p>
          <p
            className="mt-1 text-[11.5px] font-medium leading-none text-ink-soft"
            title={formatDateTime(meta?.lastSyncAt)}
          >
            {timeAgo(meta?.lastSyncAt)}
          </p>
        </div>

        <Button variant="primary" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={14} strokeWidth={2.2} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Bezig…' : 'Vernieuwen'}
        </Button>

        <Button variant="ghost" onClick={logout} title="Uitloggen" aria-label="Uitloggen">
          <LogOut size={15} strokeWidth={1.9} />
        </Button>
      </div>
    </header>
  );
}
