'use client';

import { useEffect, useMemo, useState } from 'react';
import type { QuotationRow, QuotationStatus } from '@/lib/types';
import { formatEuro, formatNumber, formatPercent, formatProduct } from '@/lib/format';

type SortKey = 'date' | 'customer' | 'revenue' | 'm2' | 'margin' | 'marginPct';

const STATUS_STYLE: Record<QuotationStatus, string> = {
  accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  open: 'bg-sky-50 text-sky-700 ring-sky-200',
  refused: 'bg-rose-50 text-rose-700 ring-rose-200',
};

const STATUS_LABEL: Record<QuotationStatus, string> = {
  accepted: 'Geaccepteerd',
  open: 'Open',
  refused: 'Geweigerd',
};

function rowDate(q: QuotationRow): string {
  return q.dateAccepted || q.dateCreated || '';
}

export default function QuotationsTable({ rows }: { rows: QuotationRow[] }) {
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
        <div className="flex rounded-lg border border-neutral-200 p-0.5 text-xs">
          {(['all', 'accepted', 'open'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-2.5 py-1 transition ${
                statusFilter === s
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-500 hover:text-neutral-900'
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
          className="ml-auto w-56 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-emerald-500"
        />
        <span className="text-xs text-neutral-400">{filtered.length} offertes</span>
      </div>

      <div className="h-[460px] overflow-auto rounded-xl border border-neutral-200">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-neutral-50 text-xs text-neutral-500">
            <tr className="border-b border-neutral-200">
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
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((q) => (
              <tr
                key={q.id}
                onClick={() => setSelectedId(q.id)}
                className="cursor-pointer hover:bg-neutral-50"
              >
                <td className="whitespace-nowrap px-3 py-2 text-neutral-500 tabular-nums">
                  {rowDate(q)}
                </td>
                <td className="px-3 py-2">
                  <div className="max-w-[220px] truncate text-neutral-800">
                    {q.customerName || '—'}
                  </div>
                  <div className="max-w-[220px] truncate text-xs text-neutral-400">{q.name}</div>
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
                <td className="px-3 py-2 text-right tabular-nums text-neutral-800">
                  {formatEuro(q.revenueExVat, true)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
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
                    <span className="text-neutral-300">—</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-500 tabular-nums">
                      {q.verified && <span className="text-emerald-600">✓</span>}
                      {formatPercent(q.matchCoverage)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-neutral-400">
                  Geen offertes gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <QuotationModal q={selected} onClose={() => setSelectedId(null)} />}
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
        onClick ? 'cursor-pointer select-none hover:text-neutral-900' : ''
      } ${className}`}
    >
      {children}
    </th>
  );
}

function marginColor(margin: number | null): string {
  if (margin == null) return 'text-neutral-400';
  return margin >= 0 ? 'text-neutral-800' : 'text-rose-600';
}

function QuotationModal({ q, onClose }: { q: QuotationRow; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lines = q.lines ?? [];
  const location = [q.postalCode, q.city].filter(Boolean).join(' ');
  const dateLabel = q.status === 'refused' ? 'Geweigerd' : 'Geaccepteerd';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-neutral-900">
                {q.customerName || '—'}
              </h3>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ring-1 ${STATUS_STYLE[q.status]}`}
              >
                {STATUS_LABEL[q.status]}
              </span>
            </div>
            <p className="mt-0.5 truncate text-sm text-neutral-500">
              {q.name}
              {location && <span className="text-neutral-400"> · {location}</span>}
            </p>
            <p className="mt-0.5 text-xs text-neutral-400 tabular-nums">
              Aangemaakt {q.dateCreated || '—'}
              {q.dateAccepted && ` · ${dateLabel} ${q.dateAccepted}`}
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

        {/* Body */}
        <div className="overflow-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Omzet (ex btw)" value={formatEuro(q.revenueExVat, true)} />
            <Stat label="Omzet (incl btw)" value={formatEuro(q.revenueInclVat, true)} />
            <Stat label="Vloeromzet" value={formatEuro(q.omzetVloer, true)} />
            <Stat label="Prijs/m²" value={formatEuro(q.prijsPerM2, true)} />
            <Stat label="M² totaal" value={formatNumber(q.totalM2)} />
            <Stat label="Kostprijs" value={formatEuro(q.cost, true)} />
            <Stat label="Marge" value={formatEuro(q.margin, true)} className={marginColor(q.margin)} />
            <Stat
              label="Marge %"
              value={formatPercent(q.marginPct)}
              className={marginColor(q.margin)}
            />
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
            <span>
              Dekking:{' '}
              <strong className="text-neutral-700">{formatPercent(q.matchCoverage)}</strong>
            </span>
            {q.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-200">
                ✓ Geverifieerd
              </span>
            )}
          </div>

          {/* Floor lines */}
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-medium text-neutral-500">Vloerregels</p>
            {lines.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-neutral-200">
                <table className="w-full text-xs">
                  <thead className="bg-neutral-50 text-neutral-400">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Product</th>
                      <th className="px-3 py-1.5 text-right font-medium">M²</th>
                      <th className="px-3 py-1.5 text-right font-medium">Omzet</th>
                      <th className="px-3 py-1.5 text-right font-medium">Marge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {lines.map((l, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5">
                          <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-700">
                            {formatProduct(l.code)}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-neutral-600">
                          {formatNumber(l.m2)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-neutral-600">
                          {formatEuro(l.revenue, true)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          <span className={marginColor(l.margin)}>{formatEuro(l.margin, true)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <span className="text-xs text-neutral-400">
                Geen gematchte vloerregels
                {q.matchCoverage != null && q.matchCoverage < 100
                  ? ' — voeg ontbrekende prijzen toe in Instellingen.'
                  : '.'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  className = 'text-neutral-800',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg bg-neutral-50 px-3 py-2">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${className}`}>{value}</div>
    </div>
  );
}

function ProductBadges({ products }: { products: string[] }) {
  if (products.length === 0) return <span className="text-neutral-300">—</span>;
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
          className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-600"
        >
          {formatProduct(p)}
        </span>
      ))}
      {rest > 0 && <span className="text-xs text-neutral-400">+{rest}</span>}
    </div>
  );
}
