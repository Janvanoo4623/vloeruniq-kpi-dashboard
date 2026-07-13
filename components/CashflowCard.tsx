'use client';

import { useEffect, useState } from 'react';
import type { AgingBucket, OverdueInvoice } from '@/lib/types';
import { formatEuro, formatNumber } from '@/lib/format';

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
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const active = openIdx == null ? null : buckets[openIdx];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <p className="mb-3 text-sm text-neutral-500">
          Totaal openstaand:{' '}
          <strong className="text-neutral-900">{formatEuro(totalOutstanding)}</strong>{' '}
          <span className="text-xs text-neutral-400">(incl. btw)</span>
        </p>
        <ul className="space-y-2.5">
          {buckets.map((b, i) => {
            const clickable = b.count > 0;
            return (
              <li key={b.label}>
                <button
                  type="button"
                  onClick={() => clickable && setOpenIdx(i)}
                  disabled={!clickable}
                  className={`w-full rounded-lg px-2 py-1 text-left text-sm transition-colors ${
                    clickable ? 'cursor-pointer hover:bg-neutral-50' : 'cursor-default'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-neutral-700">
                      {b.label}
                      {clickable && <span className="text-neutral-300">›</span>}
                    </span>
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
                </button>
              </li>
            );
          })}
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

      {active && (
        <BucketModal bucket={active} color={COLORS[openIdx!] ?? 'bg-neutral-400'} onClose={() => setOpenIdx(null)} />
      )}
    </div>
  );
}

function BucketModal({
  bucket,
  color,
  onClose,
}: {
  bucket: AgingBucket;
  color: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
              <h3 className="text-base font-semibold text-neutral-900">{bucket.label}</h3>
            </div>
            <p className="mt-0.5 text-sm text-neutral-500">
              {bucket.count} {bucket.count === 1 ? 'factuur' : 'facturen'} ·{' '}
              <strong className="text-neutral-700">{formatEuro(bucket.amount)}</strong> incl. btw
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Sluiten"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[calc(80vh-72px)] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-neutral-50 text-xs text-neutral-500">
              <tr className="border-b border-neutral-200">
                <th className="px-5 py-2 text-left font-medium">Klant</th>
                <th className="px-3 py-2 text-left font-medium">Vloer</th>
                <th className="px-3 py-2 text-right font-medium">m²</th>
                <th className="px-5 py-2 text-right font-medium">Omzet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {bucket.invoices.map((inv) => (
                <tr key={inv.id} className="align-top hover:bg-neutral-50">
                  <td className="px-5 py-2.5">
                    <div className="text-neutral-800">{inv.customerName}</div>
                    <div className="text-xs text-neutral-400">
                      vervallen {inv.dueOn || inv.invoiceDate}
                      {inv.daysOverdue > 0 && (
                        <span className="text-rose-500"> · {inv.daysOverdue}d te laat</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-neutral-700">
                    {inv.vloer ?? <span className="text-neutral-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-neutral-700">
                    {inv.m2 != null ? `${formatNumber(inv.m2)} m²` : <span className="text-neutral-300">—</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-neutral-800">
                    {formatEuro(inv.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
