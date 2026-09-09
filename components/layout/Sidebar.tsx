'use client';

import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { NAV } from '@/lib/nav';
import { cn } from '@/components/ui';

/**
 * Vaste linkernavigatie. Het actieve item licht op als witte kaart met schaduw —
 * dezelfde taal als de rest van de app, zodat "waar ben ik" één blik kost.
 * `badges` telt openstaand werk bij een route (nu alleen Controleren).
 *
 * Onder lg verdwijnt deze balk: 212 vaste pixels is meer dan de helft van een
 * telefoonscherm. Daar komt hij als lade terug — zie MobileSidebar.
 */
export default function Sidebar({ badges }: { badges?: Record<string, number> }) {
  return (
    <aside className="hidden w-[212px] shrink-0 flex-col border-r border-line bg-canvas lg:flex 2xl:w-[248px]">
      <SidebarInhoud badges={badges} />
    </aside>
  );
}

/**
 * Dezelfde navigatie als lade, voor smalle schermen.
 *
 * Via een portal naar <body>, en niet zomaar: de kopbalk heeft backdrop-blur, en
 * een element met backdrop-filter wordt het containing block voor alles wat
 * position:fixed is. Een lade die binnen die boom wordt gerenderd centreert zich
 * dan binnen een balk van 68 pixels hoog. Dezelfde val als bij de periodekiezer,
 * daar gemeten op top -214.
 */
export function MobileSidebar({
  open,
  onClose,
  badges,
}: {
  open: boolean;
  onClose: () => void;
  badges?: Record<string, number>;
}) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[130] lg:hidden">
      <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={onClose} />
      <aside className="absolute inset-y-0 left-0 flex w-[min(280px,86vw)] flex-col border-r border-line bg-canvas shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Menu sluiten"
          className="absolute right-2 top-4 rounded-lg p-1.5 text-ink-mute transition hover:bg-sunk hover:text-ink"
        >
          <X size={16} strokeWidth={2.2} />
        </button>
        <SidebarInhoud badges={badges} onNavigate={onClose} />
      </aside>
    </div>,
    document.body,
  );
}

function SidebarInhoud({
  badges,
  onNavigate,
}: {
  badges?: Record<string, number>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      <div className="flex h-[68px] shrink-0 items-center gap-2.5 border-b border-line px-5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-white">
          V
        </span>
        <div className="min-w-0">
          <p className="text-[14.5px] font-bold leading-none tracking-tight text-ink">Vloeruniq</p>
          <p className="mt-1.5 text-[10px] leading-none text-ink-faint">KPI-dashboard</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {NAV.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="mb-2 mt-5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              {group.label}
            </p>
            {group.items.map(({ href, label, Icon }) => {
              const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
              const badge = badges?.[href];
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'mb-1 flex items-center gap-3 rounded-xl border px-3 py-2.5 text-[13.5px] transition',
                    active
                      ? 'border-line bg-surface font-semibold text-ink shadow-sm'
                      : 'border-transparent font-medium text-ink-soft hover:bg-sunk hover:text-ink',
                  )}
                >
                  <Icon
                    size={17}
                    strokeWidth={1.9}
                    className={active ? 'text-accent' : 'text-ink-faint'}
                  />
                  <span className="flex-1 truncate text-left">{label}</span>
                  {badge ? (
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums',
                        active ? 'bg-warn-soft text-warn' : 'bg-warn-soft text-warn',
                      )}
                    >
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}
