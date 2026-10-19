'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FileDown, LogOut, Menu, RefreshCw } from 'lucide-react';
import { navItemFor, sectionFor } from '@/lib/nav';
import { formatDateTime, timeAgo } from '@/lib/format';
import DateRangePicker from '@/components/DateRangePicker';
import { Button } from '@/components/ui';
import { useDashboard } from './DashboardProvider';

/**
 * Vaste kop boven elke pagina: waar je bent (links) en waarmee je stuurt
 * (rechts). De periodekiezer staat hier één keer in plaats van per pagina, zodat
 * hij bij het wisselen van pagina blijft staan.
 */
export default function TopBar({ onMenu }: { onMenu?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { range, setRange, dataLoading, refresh, refreshing, meta } = useDashboard();
  const item = navItemFor(pathname);
  const section = sectionFor(pathname);
  // Op Overzicht staat de grote begroeting al als titel; dubbel hoeft niet.
  const toonTitel = pathname !== '/';

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      {/* Onder lg twee regels: titel boven, sturing eronder. Alles op één regel
          persen werkt niet op 375 pixels — dan blijft er voor de titel niets over. */}
      <div className="flex flex-col gap-2 px-4 py-2.5 lg:h-[68px] lg:flex-row lg:items-center lg:gap-4 lg:px-6 lg:py-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={onMenu}
            aria-label="Menu openen"
            className="-ml-1 shrink-0 rounded-lg p-1.5 text-ink-mute transition hover:bg-sunk hover:text-ink lg:hidden"
          >
            <Menu size={18} strokeWidth={2} />
          </button>
          <div className="min-w-0 flex-1">
            {toonTitel && (
              <>
                <h1 className="truncate text-[17px] font-semibold tracking-tight text-ink">
                  {section?.label ?? item?.title ?? 'Vloeruniq'}
                </h1>
                <p className="mt-0.5 truncate text-[12px] text-ink-mute">
                  {item?.subtitle ?? section?.subtitle ?? 'KPI-dashboard'}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 lg:contents">
          <DateRangePicker value={range} onChange={setRange} loading={dataLoading} />

          <div className="ml-auto hidden text-right lg:ml-0 lg:block">
            <p className="text-[10px] leading-none text-ink-faint">Laatst gesynct</p>
            <p
              className="mt-1 text-[11.5px] font-medium leading-none text-ink-soft"
              title={formatDateTime(meta?.lastSyncAt)}
            >
              {timeAgo(meta?.lastSyncAt)}
            </p>
          </div>

          {/* Het rapport opent in een eigen tabblad met de gekozen periode erin,
              zodat je terugkomt op de pagina waar je was. */}
          <Link
            href={`/export?from=${range.from}&to=${range.to}&compare=${range.compare}`}
            target="_blank"
            title="Exporteren: alle tabbladen als printbaar rapport"
            aria-label="Exporteren"
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-mute ring-1 ring-line transition hover:text-ink hover:ring-ink/20"
          >
            <FileDown size={14} strokeWidth={2} />
            <span className="hidden xl:inline">Export</span>
          </Link>

          <Button variant="primary" onClick={refresh} disabled={refreshing}>
            <RefreshCw size={14} strokeWidth={2.2} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{refreshing ? 'Bezig…' : 'Vernieuwen'}</span>
          </Button>

          <Button variant="ghost" onClick={logout} title="Uitloggen" aria-label="Uitloggen">
            <LogOut size={15} strokeWidth={1.9} />
          </Button>
        </div>
      </div>
    </header>
  );
}
