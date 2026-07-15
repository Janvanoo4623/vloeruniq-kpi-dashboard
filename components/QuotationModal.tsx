'use client';

import { useEffect, useState } from 'react';
import type { QuotationRow, QuotationStatus } from '@/lib/types';
import { formatEuro, formatNumber, formatPercent, formatProduct } from '@/lib/format';
import PriceInput from './PriceInput';
import QuotationCorrection from './QuotationCorrection';

export const STATUS_STYLE: Record<QuotationStatus, string> = {
  accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  open: 'bg-sky-50 text-sky-700 ring-sky-200',
  refused: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export const STATUS_LABEL: Record<QuotationStatus, string> = {
  accepted: 'Geaccepteerd',
  open: 'Open',
  refused: 'Geweigerd',
};

export function marginColor(margin: number | null): string {
  if (margin == null) return 'text-neutral-400';
  return margin >= 0 ? 'text-neutral-800' : 'text-rose-600';
}

export default function QuotationModal({
  q,
  onClose,
  pricedCodes,
}: {
  q: QuotationRow;
  onClose: () => void;
  pricedCodes?: Set<string>;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [savedCodes, setSavedCodes] = useState<Set<string>>(new Set());
  const lines = q.lines ?? [];
  // A line is fillable when it has no margin (unpriced) and isn't already priced.
  const isUnpriced = (code: string, margin: number | null) =>
    margin === null && !pricedCodes?.has(code.toLowerCase()) && !savedCodes.has(code.toLowerCase());
  const hasUnpriced = lines.some((l) => isUnpriced(l.code, l.margin));
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
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Sluiten"
            >
              ✕
            </button>
            <div className="flex items-center gap-2 whitespace-nowrap text-xs text-neutral-500">
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
          </div>
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
                          {l.desc && (
                            <span className="mt-0.5 block max-w-[16rem] truncate text-[11px] text-neutral-400" title={l.desc}>
                              {l.desc}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-neutral-600">
                          {formatNumber(l.m2)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-neutral-600">
                          {formatEuro(l.revenue, true)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {isUnpriced(l.code, l.margin) ? (
                            <PriceInput
                              code={l.code}
                              onSaved={(c) =>
                                setSavedCodes((s) => new Set(s).add(c.toLowerCase()))
                              }
                            />
                          ) : (
                            <span className={marginColor(l.margin)}>{formatEuro(l.margin, true)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {hasUnpriced && (
                  <p className="border-t border-neutral-100 bg-amber-50/50 px-3 py-1.5 text-xs text-amber-700">
                    Vul de inkoopprijs (€/m²) in bij regels zonder marge. Wordt in de marges
                    verwerkt bij de eerstvolgende synchronisatie.
                  </p>
                )}
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

          <QuotationCorrection q={q} />
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
