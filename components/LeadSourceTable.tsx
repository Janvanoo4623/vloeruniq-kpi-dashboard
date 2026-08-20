'use client';

import type { LeadSourceStat } from '@/lib/types';
import { formatEuro, formatPercent, formatDays } from '@/lib/format';

export default function LeadSourceTable({ data }: { data: LeadSourceStat[] }) {
  if (data.length === 0) {
    return <div className="flex h-24 items-center justify-center text-sm text-ink-faint">Geen data</div>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-sunk text-xs text-ink-mute">
          <tr className="border-b border-line">
            <th className="px-3 py-2 text-left font-medium">Leadbron</th>
            <th className="px-3 py-2 text-right font-medium">Omzet</th>
            <th className="px-3 py-2 text-right font-medium"># deals</th>
            <th className="px-3 py-2 text-right font-medium">Gem. deal</th>
            <th className="px-3 py-2 text-right font-medium">Marge %</th>
            <th className="px-3 py-2 text-right font-medium">Gem. doorlooptijd</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hair">
          {data.map((s) => (
            <tr key={s.name} className="hover:bg-sunk">
              <td className="px-3 py-2 text-ink">{s.name}</td>
              <td className="px-3 py-2 text-right tabular-nums text-ink">{formatEuro(s.revenue)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-ink-mute">{s.count}</td>
              <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{formatEuro(s.avgDealSize)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{formatPercent(s.marginPct)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{formatDays(s.avgRunTimeDays)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
