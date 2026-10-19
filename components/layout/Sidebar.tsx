'use client';

import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { SETTINGS_SECTION, SIDEBAR, isRouteActive, type NavSection } from '@/lib/nav';
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
      {/* Hun eigen logo, van vloeruniq.nl. Het groen erin blijft het enige
          stukje huisgroen: als accentkleur zou het verward worden met "goed". */}
      <Link href="/" onClick={onNavigate} className="flex h-[68px] shrink-0 flex-col justify-center gap-1.5 border-b border-line px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.svg" alt="Vloeruniq" width={112} height={21} className="h-[21px] w-auto self-start" />
        <p className="text-[10px] font-medium uppercase leading-none tracking-[0.14em] text-ink-faint">KPI-dashboard</p>
      </Link>

      <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-2">
        {SIDEBAR.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="mb-2 mt-5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              {group.label}
            </p>
            {group.items.map((section) => (
              <SectionLink key={section.label} section={section} pathname={pathname} badges={badges} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
        <div className="mt-auto border-t border-hair pt-3">
          <SectionLink section={SETTINGS_SECTION} pathname={pathname} badges={badges} onNavigate={onNavigate} />
        </div>
      </nav>
    </>
  );
}

/**
 * Eén onderdeel in de zijbalk. Actief = zwarte pil met het icoon in merkgroen,
 * dezelfde taal als de knoppen op Overzicht. Een badge telt open werk over alle
 * pagina's van het onderdeel.
 */
function SectionLink({
  section,
  pathname,
  badges,
  onNavigate,
}: {
  section: NavSection;
  pathname: string;
  badges?: Record<string, number>;
  onNavigate?: () => void;
}) {
  const active = section.routes.some((r) => isRouteActive(pathname, r.href));
  const badge = section.routes.reduce((t, r) => t + (badges?.[r.href] ?? 0), 0);
  const { Icon } = section;
  return (
    <Link
      href={section.routes[0].href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'mb-1 flex items-center gap-3 rounded-full px-3.5 py-2.5 text-[13.5px] transition',
        active ? 'bg-night font-semibold text-white shadow-[0_8px_18px_-10px_rgba(19,19,19,0.7)]' : 'font-medium text-ink-soft hover:bg-sunk hover:text-ink',
      )}
    >
      <Icon size={17} strokeWidth={1.9} className={active ? 'text-brand' : 'text-ink-faint'} />
      <span className="flex-1 truncate text-left">{section.label}</span>
      {badge > 0 && (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular-nums',
            active ? 'bg-white/15 text-white' : 'bg-warn-soft text-warn',
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
