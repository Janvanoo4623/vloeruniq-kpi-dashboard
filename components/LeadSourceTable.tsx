'use client';

import type { LeadSourceStat } from '@/lib/types';
import { formatEuro, formatPercent, formatDays } from '@/lib/format';

export default function LeadSourceTable({ data }: { data: LeadSourceStat[] }) {
  if (data.length === 0) {
    return <div className="flex h-24 items-center justify-center text-sm text-neutral-400">Geen data</div>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-neutral-50 text-xs text-neutral-500">
          <tr className="border-b border-neutral-200">
            <th className="px-3 py-2 text-left font-medium">Leadbron</th>
            <th className="px-3 py-2 text-right font-medium">Omzet</th>
            <th className="px-3 py-2 text-right font-medium"># deals</th>
            <th className="px-3 py-2 text-right font-medium">Gem. deal</th>
            <th className="px-3 py-2 text-right font-medium">Marge %</th>
            <th className="px-3 py-2 text-right font-medium">Gem. doorlooptijd</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {data.map((s) => (
            <tr key={s.name} className="hover:bg-neutral-50">
              <td className="px-3 py-2 text-neutral-800">{s.name}</td>
              <td className="px-3 py-2 text-right tabular-nums text-neutral-800">{formatEuro(s.revenue)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-neutral-500">{s.count}</td>
              <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{formatEuro(s.avgDealSize)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{formatPercent(s.marginPct)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{formatDays(s.avgRunTimeDays)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
