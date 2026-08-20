'use client';

import type { RegionStat } from '@/lib/types';
import { formatEuro } from '@/lib/format';
import { Empty } from '@/components/ui';

/**
 * Ranglijst met balken in plaats van een kaart: bij acht plaatsen is een lijst
 * sneller af te lezen dan een geografische weergave, en de balk geeft de
 * verhouding die een getal alleen niet geeft.
 */
export default function RegionList({ data }: { data: RegionStat[] }) {
  const top = data.slice(0, 8);
  const max = Math.max(1, ...top.map((d) => d.revenue));

  if (top.length === 0) return <Empty className="h-[240px]">Geen data</Empty>;

  return (
    <ol className="space-y-2.5">
      {top.map((d, i) => (
        <li key={d.name} className="group">
          <div className="mb-1.5 flex items-baseline gap-2.5 text-[13px]">
            <span className="w-4 shrink-0 text-[11px] font-semibold tabular-nums text-ink-faint">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-ink-soft">{d.name}</span>
            <span className="shrink-0 text-[11.5px] tabular-nums text-ink-faint">{d.count}×</span>
            <span className="w-[86px] shrink-0 text-right font-semibold tabular-nums text-ink">
              {formatEuro(d.revenue)}
            </span>
          </div>
          <div className="ml-[26px] h-2 overflow-hidden rounded-full bg-sunk">
            <span
              className="block h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${(d.revenue / max) * 100}%`,
                backgroundImage: 'linear-gradient(90deg, var(--color-oak) 0%, color-mix(in oklab, var(--color-oak) 62%, white) 100%)',
              }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
