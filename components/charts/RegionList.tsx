'use client';

import type { RegionStat } from '@/lib/types';
import { formatEuro } from '@/lib/format';

export default function RegionList({ data }: { data: RegionStat[] }) {
  const top = data.slice(0, 8);
  const max = Math.max(1, ...top.map((d) => d.revenue));

  if (top.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-ink-faint">
        Geen data
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {top.map((d) => (
        <li key={d.name} className="text-sm">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="truncate text-ink-soft">{d.name}</span>
            <span className="shrink-0 tabular-nums text-ink-mute">
              {formatEuro(d.revenue)}
              <span className="ml-2 text-ink-faint">{d.count}×</span>
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunk">
            <span
              className="block h-full rounded-full bg-oak"
              style={{ width: `${(d.revenue / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
