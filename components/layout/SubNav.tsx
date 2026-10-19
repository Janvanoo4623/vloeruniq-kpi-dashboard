'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isRouteActive, sectionFor } from '@/lib/nav';
import { cn } from '@/components/ui';

/**
 * De pilschakelaar tussen de pagina's van één onderdeel (Verkoop: Pijplijn ·
 * Offertes · Verloren). Alleen zichtbaar als een onderdeel meer dan één pagina
 * heeft. Echte links, dus elke pagina houdt zijn eigen adres.
 */
export default function SubNav() {
  const pathname = usePathname();
  const section = sectionFor(pathname);
  if (!section || section.routes.length < 2) return null;
  return (
    <nav aria-label={section.label} className="mb-5 flex">
      <div className="flex rounded-full bg-surface p-1 shadow-[0_1px_2px_rgba(19,19,19,0.05),0_10px_24px_-18px_rgba(19,19,19,0.3)]">
        {section.routes.map((r) => {
          const actief = isRouteActive(pathname, r.href);
          return (
            <Link
              key={r.href}
              href={r.href}
              aria-current={actief ? 'page' : undefined}
              className={cn(
                'rounded-full px-4 py-2 text-[13.5px] font-medium transition',
                actief ? 'bg-night text-white shadow-sm' : 'text-ink-mute hover:text-ink',
              )}
            >
              {r.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
