'use client';

import type { AgingBucket, OverdueInvoice } from '@/lib/types';
import { formatEuro } from '@/lib/format';

const COLORS = ['bg-emerald-500', 'bg-amber-400', 'bg-orange-500', 'bg-rose-500', 'bg-rose-700'];

export default function CashflowCard({
  buckets,
  overdue,
  totalOutstanding,
}: {
  buckets: AgingBucket[];
  overdue: OverdueInvoice[];
  totalOutstanding: number;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.amount));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <p className="mb-3 text-sm text-neutral-500">
          Totaal openstaand:{' '}
          <strong className="text-neutral-900">{formatEuro(totalOutstanding)}</strong>{' '}
          <span className="text-xs text-neutral-400">(incl. btw)</span>
        </p>
        <ul className="space-y-2.5">
          {buckets.map((b, i) => (
            <li key={b.label} className="text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-neutral-700">{b.label}</span>
                <span className="shrink-0 tabular-nums text-neutral-600">
                  {formatEuro(b.amount)} <span className="text-neutral-400">· {b.count}</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                <span
                  className={`block h-full rounded-full ${COLORS[i] ?? 'bg-neutral-400'}`}
                  style={{ width: `${(b.amount / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-neutral-700">Langst openstaand</p>
        <div className="max-h-[240px] overflow-auto rounded-xl border border-neutral-200">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-neutral-50 text-xs text-neutral-500">
              <tr className="border-b border-neutral-200">
                <th className="px-3 py-2 text-left font-medium">Klant</th>
                <th className="px-3 py-2 text-right font-medium">Te laat</th>
                <th className="px-3 py-2 text-right font-medium">Bedrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {overdue.map((o) => (
                <tr key={o.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2">
                    <div className="max-w-[200px] truncate text-neutral-800">{o.customerName}</div>
                    <div className="text-xs text-neutral-400">vervallen {o.dueOn || o.invoiceDate}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-rose-600">{o.daysOverdue}d</td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-700">{formatEuro(o.amount)}</td>
                </tr>
              ))}
              {overdue.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-sm text-neutral-400">
                    Niets te laat 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
