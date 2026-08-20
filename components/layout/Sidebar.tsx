'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from '@/lib/nav';
import { cn } from '@/components/ui';

/**
 * Vaste linkernavigatie. Het actieve item licht op als witte kaart met schaduw —
 * dezelfde taal als de rest van de app, zodat "waar ben ik" één blik kost.
 * `badges` telt openstaand werk bij een route (nu alleen Controleren).
 */
export default function Sidebar({ badges }: { badges?: Record<string, number> }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[212px] shrink-0 flex-col border-r border-line bg-canvas 2xl:w-[248px]">
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
    </aside>
  );
}
