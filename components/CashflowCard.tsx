'use client';

import { useEffect, useState } from 'react';
import type { AgingBucket, OverdueInvoice, QuotationRow } from '@/lib/types';
import { formatEuro, formatNumber } from '@/lib/format';
import QuotationModal from './QuotationModal';

const COLORS = ['bg-accent', 'bg-warn', 'bg-orange-500', 'bg-crit', 'bg-crit'];

export default function CashflowCard({
  buckets,
  overdue,
  totalOutstanding,
  pricedCodes,
}: {
  buckets: AgingBucket[];
  overdue: OverdueInvoice[];
  totalOutstanding: number;
  pricedCodes?: Set<string>;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.amount));
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [quotation, setQuotation] = useState<QuotationRow | null>(null);
  const active = openIdx == null ? null : buckets[openIdx];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div>
        <p className="mb-3 text-sm text-ink-mute">
          Totaal openstaand:{' '}
          <strong className="text-ink">{formatEuro(totalOutstanding)}</strong>{' '}
          <span className="text-xs text-ink-faint">(incl. btw)</span>
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
                    clickable ? 'cursor-pointer hover:bg-sunk' : 'cursor-default'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-ink-soft">
                      {b.label}
                      {clickable && <span className="text-ink-faint">›</span>}
                    </span>
                    <span className="shrink-0 tabular-nums text-ink-soft">
                      {formatEuro(b.amount)} <span className="text-ink-faint">· {b.count}</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunk">
                    <span
                      className={`block h-full rounded-full ${COLORS[i] ?? 'bg-ink-faint'}`}
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
        <p className="mb-2 text-sm font-medium text-ink-soft">Langst openstaand</p>
        <div className="max-h-[240px] overflow-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-sunk text-xs text-ink-mute">
              <tr className="border-b border-line">
                <th className="px-3 py-2 text-left font-medium">Klant</th>
                <th className="px-3 py-2 text-right font-medium">Te laat</th>
                <th className="px-3 py-2 text-right font-medium">Bedrag</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {overdue.map((o) => {
                const clickable = o.quotation != null;
                return (
                  <tr
                    key={o.id}
                    onClick={() => o.quotation && setQuotation(o.quotation)}
                    className={`hover:bg-sunk ${clickable ? 'cursor-pointer' : ''}`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex max-w-[200px] items-center gap-1 truncate text-ink">
                        {o.customerName}
                        {clickable && <span className="text-ink-faint">›</span>}
                      </div>
                      <div className="text-xs text-ink-faint">vervallen {o.dueOn || o.invoiceDate}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-crit">{o.daysOverdue}d</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{formatEuro(o.amount)}</td>
                  </tr>
                );
              })}
              {overdue.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-sm text-ink-faint">
                    Niets te laat 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {active && (
        <BucketModal bucket={active} color={COLORS[openIdx!] ?? 'bg-ink-faint'} onClose={() => setOpenIdx(null)} />
      )}

      {quotation && (
        <QuotationModal q={quotation} onClose={() => setQuotation(null)} pricedCodes={pricedCodes} />
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
              <h3 className="text-base font-semibold text-ink">{bucket.label}</h3>
            </div>
            <p className="mt-0.5 text-sm text-ink-mute">
              {bucket.count} {bucket.count === 1 ? 'factuur' : 'facturen'} ·{' '}
              <strong className="text-ink-soft">{formatEuro(bucket.amount)}</strong> incl. btw
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink-faint hover:bg-sunk hover:text-ink-soft"
            aria-label="Sluiten"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[calc(80vh-72px)] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-sunk text-xs text-ink-mute">
              <tr className="border-b border-line">
                <th className="px-5 py-2 text-left font-medium">Klant</th>
                <th className="px-3 py-2 text-left font-medium">Vloer</th>
                <th className="px-3 py-2 text-right font-medium">m²</th>
                <th className="px-5 py-2 text-right font-medium">Omzet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {bucket.invoices.map((inv) => (
                <tr key={inv.id} className="align-top hover:bg-sunk">
                  <td className="px-5 py-2.5">
                    <div className="text-ink">{inv.customerName}</div>
                    <div className="text-xs text-ink-faint">
                      vervallen {inv.dueOn || inv.invoiceDate}
                      {inv.daysOverdue > 0 && (
                        <span className="text-crit"> · {inv.daysOverdue}d te laat</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-ink-soft">
                    {inv.vloer ?? <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                    {inv.m2 != null ? `${formatNumber(inv.m2)} m²` : <span className="text-ink-faint">—</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-ink">
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
