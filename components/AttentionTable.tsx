'use client';

import { useMemo, useState } from 'react';
import type { QuotationRow } from '@/lib/types';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import QuotationModal from './QuotationModal';

function rowDate(q: QuotationRow): string {
  return q.dateAccepted || q.dateCreated || '';
}

/**
 * Aandachtspunten op de margepagina: waar verdien je te weinig, en waar is de
 * prijsdekking onvolledig. Ontbrekende inkoopprijzen stonden hier ook, maar die
 * horen bij het werk dat je moet dóén en staan nu op Controleren — één plek voor
 * openstaande punten in plaats van twee.
 */
export default function AttentionTable({
  rows,
  pricedCodes,
}: {
  rows: QuotationRow[];
  /** Alleen nog doorgegeven aan de offerte-modal, die er prijzen mee invult. */
  pricedCodes?: Set<string>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? rows.find((q) => q.id === selectedId) ?? null : null;
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink-soft">
          Laagste marge <span className="font-normal text-ink-faint">(geaccepteerd)</span>
        </h3>
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-sunk text-xs text-ink-mute">
              <tr className="border-b border-line">
                <th className="px-3 py-2 text-left font-medium">Klant</th>
                <th className="px-3 py-2 text-right font-medium">Omzet</th>
                <th className="px-3 py-2 text-right font-medium">Marge €</th>
                <th className="px-3 py-2 text-right font-medium">Marge %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {lowMargin.map((q) => {
                const neg = (q.margin ?? 0) < 0;
                return (
                  <tr
                    key={q.id}
                    onClick={() => setSelectedId(q.id)}
                    className="cursor-pointer hover:bg-sunk"
                  >
                    <td className="px-3 py-2">
                      <div className="max-w-[180px] truncate text-ink">{q.customerName || '—'}</div>
                      <div className="text-xs text-ink-faint">{rowDate(q)}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{formatEuro(q.revenueExVat)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${neg ? 'text-crit font-medium' : 'text-ink-soft'}`}>
                      {formatEuro(q.margin, true)}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${neg ? 'text-crit font-medium' : 'text-ink-soft'}`}>
                      {formatPercent(q.marginPct)}
                    </td>
                  </tr>
                );
              })}
              {lowMargin.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-ink-faint">Geen data.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink-soft">
          Onvolledige dekking <span className="font-normal text-ink-faint">(niet alle m² geprijsd)</span>
        </h3>
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-sunk text-xs text-ink-mute">
              <tr className="border-b border-line">
                <th className="px-3 py-2 text-left font-medium">Klant</th>
                <th className="px-3 py-2 text-right font-medium">M²</th>
                <th className="px-3 py-2 text-right font-medium">Dekking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {lowCoverage.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => setSelectedId(q.id)}
                  className="cursor-pointer hover:bg-sunk"
                >
                  <td className="px-3 py-2">
                    <div className="max-w-[220px] truncate text-ink">{q.customerName || '—'}</div>
                    <div className="max-w-[220px] truncate text-xs text-ink-faint">{q.name} · {rowDate(q)}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{formatNumber(q.totalM2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-warn font-medium">{formatPercent(q.matchCoverage)}</td>
                </tr>
              ))}
              {lowCoverage.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-sm text-ink-faint">Alles 100% gedekt 🎉</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      {selected && (
        <QuotationModal q={selected} onClose={() => setSelectedId(null)} pricedCodes={pricedCodes} />
      )}
    </div>
  );
}

