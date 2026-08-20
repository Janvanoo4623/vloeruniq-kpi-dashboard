'use client';

import { useMemo, useState } from 'react';
import type { QuotationRow } from '@/lib/types';
import { formatEuro, formatNumber, formatPercent, formatProduct } from '@/lib/format';
import { computeMissingPrices } from '@/lib/missing-prices';
import QuotationModal from './QuotationModal';
import PriceInput from './PriceInput';

function rowDate(q: QuotationRow): string {
  return q.dateAccepted || q.dateCreated || '';
}

export default function AttentionTable({
  rows,
  pricedCodes,
}: {
  rows: QuotationRow[];
  pricedCodes?: Set<string>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? rows.find((q) => q.id === selectedId) ?? null : null;
  const [savedCodes, setSavedCodes] = useState<Set<string>>(new Set());

  const missing = useMemo(() => {
    const exclude = new Set([...(pricedCodes ?? []), ...savedCodes]);
    return computeMissingPrices(rows, exclude);
  }, [rows, pricedCodes, savedCodes]);
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
      {missing.length > 0 && (
        <MissingPricesBlock
          missing={missing}
          onSaved={(c) => setSavedCodes((s) => new Set(s).add(c.toLowerCase()))}
        />
      )}

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

function MissingPricesBlock({
  missing,
  onSaved,
}: {
  missing: import('@/lib/missing-prices').MissingPrice[];
  onSaved: (code: string) => void;
}) {
  const totalRevenue = missing.reduce((s, m) => s + m.revenue, 0);
  return (
    <div className="rounded-xl border border-warn/25 bg-warn-soft/50 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-warn">
          Ontbrekende inkoopprijzen{' '}
          <span className="font-normal text-warn">
            ({missing.length} {missing.length === 1 ? 'product' : 'producten'})
          </span>
        </h3>
        <span className="text-xs text-warn">
          {formatEuro(totalRevenue)} omzet zonder marge
        </span>
      </div>
      <p className="mb-3 text-xs text-warn/80">
        Deze vloerproducten hebben geen inkoopprijs — vul €/m² in om de marge te completeren.
        Wordt bij de eerstvolgende synchronisatie verwerkt en geldt ook voor oudere offertes.
      </p>
      <div className="overflow-hidden rounded-lg border border-warn/25 bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-warn-soft text-xs text-warn/70">
            <tr className="border-b border-warn/15">
              <th className="px-3 py-2 text-left font-medium">Product</th>
              <th className="px-3 py-2 text-right font-medium">Offertes</th>
              <th className="px-3 py-2 text-right font-medium">M²</th>
              <th className="px-3 py-2 text-right font-medium">Omzet</th>
              <th className="px-3 py-2 text-right font-medium">Inkoopprijs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warn/15">
            {missing.map((m) => (
              <tr key={m.code}>
                <td className="px-3 py-2">
                  <span className="rounded bg-sunk px-1.5 py-0.5 font-medium text-ink-soft">
                    {formatProduct(m.code)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-soft">
                  {m.quotationCount}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-soft">
                  {formatNumber(m.m2)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-soft">
                  {formatEuro(m.revenue)}
                </td>
                <td className="px-3 py-2 text-right">
                  <PriceInput code={m.code} onSaved={onSaved} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
