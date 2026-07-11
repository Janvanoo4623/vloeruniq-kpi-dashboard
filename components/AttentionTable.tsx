'use client';

import { useMemo } from 'react';
import type { QuotationRow } from '@/lib/types';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';

function rowDate(q: QuotationRow): string {
  return q.dateAccepted || q.dateCreated || '';
}

export default function AttentionTable({ rows }: { rows: QuotationRow[] }) {
  const lowMargin = useMemo(
    () =>
      rows
        .filter((q) => q.status === 'accepted' && q.margin !== null)
        .sort((a, b) => (a.marginPct ?? 0) - (b.marginPct ?? 0))
        .slice(0, 15),
    [rows],
  );

  const lowCoverage = useMemo(
    () =>
      rows
        .filter((q) => q.matchCoverage !== null && q.matchCoverage < 100)
        .sort((a, b) => (a.matchCoverage ?? 0) - (b.matchCoverage ?? 0))
        .slice(0, 15),
    [rows],
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-neutral-700">
          Laagste marge <span className="font-normal text-neutral-400">(geaccepteerd)</span>
        </h3>
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr className="border-b border-neutral-200">
                <th className="px-3 py-2 text-left font-medium">Klant</th>
                <th className="px-3 py-2 text-right font-medium">Omzet</th>
                <th className="px-3 py-2 text-right font-medium">Marge €</th>
                <th className="px-3 py-2 text-right font-medium">Marge %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {lowMargin.map((q) => {
                const neg = (q.margin ?? 0) < 0;
                return (
                  <tr key={q.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2">
                      <div className="max-w-[180px] truncate text-neutral-800">{q.customerName || '—'}</div>
                      <div className="text-xs text-neutral-400">{rowDate(q)}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{formatEuro(q.revenueExVat)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${neg ? 'text-rose-600 font-medium' : 'text-neutral-700'}`}>
                      {formatEuro(q.margin, true)}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${neg ? 'text-rose-600 font-medium' : 'text-neutral-700'}`}>
                      {formatPercent(q.marginPct)}
                    </td>
                  </tr>
                );
              })}
              {lowMargin.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-neutral-400">Geen data.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-neutral-700">
          Onvolledige dekking <span className="font-normal text-neutral-400">(niet alle m² geprijsd)</span>
        </h3>
        <div className="overflow-hidden rounded-xl border border-neutral-200">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr className="border-b border-neutral-200">
                <th className="px-3 py-2 text-left font-medium">Klant</th>
                <th className="px-3 py-2 text-right font-medium">M²</th>
                <th className="px-3 py-2 text-right font-medium">Dekking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {lowCoverage.map((q) => (
                <tr key={q.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2">
                    <div className="max-w-[220px] truncate text-neutral-800">{q.customerName || '—'}</div>
                    <div className="max-w-[220px] truncate text-xs text-neutral-400">{q.name} · {rowDate(q)}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{formatNumber(q.totalM2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-600 font-medium">{formatPercent(q.matchCoverage)}</td>
                </tr>
              ))}
              {lowCoverage.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-sm text-neutral-400">Alles 100% gedekt 🎉</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
