'use client';

import { useMemo, useState } from 'react';
import type { ProductStat } from '@/lib/types';
import { formatEuro, formatNumber, formatPercent, formatProduct } from '@/lib/format';

type SortKey = 'revenue' | 'm2' | 'margin' | 'marginPct' | 'count';

export default function ProductsTable({ rows }: { rows: ProductStat[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [asc, setAsc] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    let r = rows;
    if (query.trim()) {
      const needle = query.toLowerCase();
      r = r.filter((p) => p.code.toLowerCase().includes(needle));
    }
    return [...r].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return asc ? av - bv : bv - av;
    });
  }, [rows, query, sortKey, asc]);

  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue));

  function toggleSort(key: SortKey) {
    if (sortKey === key) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(false);
    }
  }
  const arrow = (key: SortKey) => (sortKey === key ? (asc ? ' ▲' : ' ▼') : '');

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek product / P-nummer…"
          className="w-56 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-emerald-500"
        />
        <span className="text-xs text-neutral-400">{filtered.length} producten</span>
      </div>

      <div className="h-[460px] overflow-auto rounded-xl border border-neutral-200">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-neutral-50 text-xs text-neutral-500">
            <tr className="border-b border-neutral-200">
              <Th>Product</Th>
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
              <Th className="text-right" onClick={() => toggleSort('count')}>
                # Offertes{arrow('count')}
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((p) => (
              <tr key={p.code} className="hover:bg-neutral-50">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700">
                      {formatProduct(p.code)}
                    </span>
                    <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-neutral-100 sm:block">
                      <span
                        className="block h-full rounded-full bg-emerald-500"
                        style={{ width: `${(p.revenue / maxRevenue) * 100}%` }}
                      />
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-neutral-800">
                  {formatEuro(p.revenue)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                  {formatNumber(p.m2)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-neutral-800">
                  {formatEuro(p.margin)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                  {formatPercent(p.marginPct)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-neutral-500">{p.count}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-neutral-400">
                  Geen producten gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
