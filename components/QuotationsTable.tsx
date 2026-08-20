'use client';

import { useMemo, useState } from 'react';
import type { QuotationRow, QuotationStatus } from '@/lib/types';
import { formatEuro, formatNumber, formatPercent, formatProduct } from '@/lib/format';
import QuotationModal, { STATUS_STYLE, STATUS_LABEL, marginColor } from './QuotationModal';

type SortKey = 'date' | 'customer' | 'revenue' | 'm2' | 'margin' | 'marginPct';

function rowDate(q: QuotationRow): string {
  return q.dateAccepted || q.dateCreated || '';
}

export default function QuotationsTable({
  rows,
  pricedCodes,
}: {
  rows: QuotationRow[];
  pricedCodes?: Set<string>;
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | QuotationStatus>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [asc, setAsc] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let r = rows;
    if (statusFilter !== 'all') r = r.filter((q) => q.status === statusFilter);
    if (query.trim()) {
      const needle = query.toLowerCase();
      r = r.filter(
        (q) =>
          q.customerName.toLowerCase().includes(needle) ||
          q.name.toLowerCase().includes(needle) ||
          (q.products ?? []).some((p) => p.toLowerCase().includes(needle)),
      );
    }
    const sorted = [...r].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'date':
          cmp = rowDate(a).localeCompare(rowDate(b));
          break;
        case 'customer':
          cmp = a.customerName.localeCompare(b.customerName);
          break;
        case 'revenue':
          cmp = a.revenueExVat - b.revenueExVat;
          break;
        case 'm2':
          cmp = a.totalM2 - b.totalM2;
          break;
        case 'margin':
          cmp = (a.margin ?? -Infinity) - (b.margin ?? -Infinity);
          break;
        case 'marginPct':
          cmp = (a.marginPct ?? -Infinity) - (b.marginPct ?? -Infinity);
          break;
      }
      return asc ? cmp : -cmp;
    });
    return sorted;
  }, [rows, statusFilter, query, sortKey, asc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(false);
    }
  }

  const arrow = (key: SortKey) => (sortKey === key ? (asc ? ' ▲' : ' ▼') : '');

  const selected = selectedId ? rows.find((q) => q.id === selectedId) ?? null : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line p-0.5 text-xs">
          {(['all', 'accepted', 'open'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-2.5 py-1 transition ${
                statusFilter === s
                  ? 'bg-ink text-white'
                  : 'text-ink-mute hover:text-ink'
              }`}
            >
              {s === 'all' ? 'Alle' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek klant of offerte…"
          className="ml-auto w-56 rounded-lg border border-line bg-white px-3 py-1.5 text-xs outline-none focus:border-accent"
        />
        <span className="text-xs text-ink-faint">{filtered.length} offertes</span>
      </div>

      <div className="h-[460px] overflow-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-sunk text-xs text-ink-mute">
            <tr className="border-b border-line">
              <Th onClick={() => toggleSort('date')}>Datum{arrow('date')}</Th>
              <Th onClick={() => toggleSort('customer')}>Klant{arrow('customer')}</Th>
              <Th>Vloer</Th>
              <Th className="text-center">Status</Th>
              <Th className="text-right" onClick={() => toggleSort('revenue')}>
                Omzet{arrow('revenue')}
              </Th>
              <Th className="text-right" onClick={() => toggleSort('m2')}>
                M²{arrow('m2')}
              </Th>
              <Th className="text-right" onClick={() => toggleSort('margin')}>
                Marge €{arrow('margin')}
              </Th>
              <Th className="text-right" onClick={() => toggleSort('marginPct')}>
                Marge %{arrow('marginPct')}
              </Th>
              <Th className="text-center">Dekking</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {filtered.map((q) => (
              <tr
                key={q.id}
                onClick={() => setSelectedId(q.id)}
                className="cursor-pointer hover:bg-sunk"
              >
                <td className="whitespace-nowrap px-3 py-2 text-ink-mute tabular-nums">
                  {rowDate(q)}
                </td>
                <td className="px-3 py-2">
                  <div className="max-w-[220px] truncate text-ink">
                    {q.customerName || '—'}
                  </div>
                  <div className="max-w-[220px] truncate text-xs text-ink-faint">{q.name}</div>
                </td>
                <td className="px-3 py-2">
                  <ProductBadges products={q.products ?? []} />
                </td>
                <td className="px-3 py-2 text-center">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs ring-1 ${STATUS_STYLE[q.status]}`}
                  >
                    {STATUS_LABEL[q.status]}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-ink">
                  {formatEuro(q.revenueExVat, true)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-mute">
                  {formatNumber(q.totalM2)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span className={marginColor(q.margin)}>{formatEuro(q.margin, true)}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <span className={marginColor(q.margin)}>{formatPercent(q.marginPct)}</span>
                </td>
                <td className="px-3 py-2 text-center">
                  {q.matchCoverage == null ? (
                    <span className="text-ink-faint">—</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-ink-mute tabular-nums">
                      {q.verified && <span className="text-good">✓</span>}
                      {formatPercent(q.matchCoverage)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-ink-faint">
                  Geen offertes gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <QuotationModal q={selected} onClose={() => setSelectedId(null)} pricedCodes={pricedCodes} />
      )}
    </div>
  );
}

function Th({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 text-left font-medium ${
        onClick ? 'cursor-pointer select-none hover:text-ink' : ''
      } ${className}`}
    >
      {children}
    </th>
  );
}

function ProductBadges({ products }: { products: string[] }) {
  if (products.length === 0) return <span className="text-ink-faint">—</span>;
  const shown = products.slice(0, 2);
  const rest = products.length - shown.length;
  return (
    <div
      className="flex max-w-[160px] flex-wrap items-center gap-1"
      title={products.map(formatProduct).join(', ')}
    >
      {shown.map((p) => (
        <span
          key={p}
          className="rounded bg-sunk px-1.5 py-0.5 text-xs font-medium text-ink-soft"
        >
          {formatProduct(p)}
        </span>
      ))}
      {rest > 0 && <span className="text-xs text-ink-faint">+{rest}</span>}
    </div>
  );
}
