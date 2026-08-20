'use client';

import { useEffect, useState } from 'react';
import type { QuotationRow, QuotationStatus } from '@/lib/types';
import { formatEuro, formatNumber, formatPercent, formatProduct } from '@/lib/format';
import PriceInput from './PriceInput';
import QuotationCorrection from './QuotationCorrection';

export const STATUS_STYLE: Record<QuotationStatus, string> = {
  accepted: 'bg-good-soft text-good ring-good/30',
  open: 'bg-oak-soft text-oak ring-oak/30',
  refused: 'bg-crit-soft text-crit ring-crit/30',
  // Verlopen is een verlies, maar geen afwijzing — grijs in plaats van rood,
  // zodat je in één blik ziet dat hier niemand 'nee' heeft gezegd.
  expired: 'bg-sunk text-ink-mute ring-ink-faint/30',
};

export const STATUS_LABEL: Record<QuotationStatus, string> = {
  accepted: 'Geaccepteerd',
  open: 'Open',
  refused: 'Geweigerd',
  expired: 'Verlopen',
};

export function marginColor(margin: number | null): string {
  if (margin == null) return 'text-ink-faint';
  return margin >= 0 ? 'text-ink' : 'text-crit';
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className={[
          // Ruimer dan de oude max-w-2xl: er staan acht kerncijfers, een
          // regeltabel en een correctieblok in, en die stonden geknepen.
          'flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-surface',
          'max-h-[90vh] border border-line',
          'shadow-[0_24px_64px_-16px_rgba(28,25,23,0.45)]',
          'animate-rise-in',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-ink">
                {q.customerName || '—'}
              </h3>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ring-1 ${STATUS_STYLE[q.status]}`}
              >
                {STATUS_LABEL[q.status]}
              </span>
            </div>
            <p className="mt-0.5 truncate text-sm text-ink-mute">
              {q.name}
              {location && <span className="text-ink-faint"> · {location}</span>}
            </p>
            <p className="mt-0.5 text-xs text-ink-faint tabular-nums">
              Aangemaakt {q.dateCreated || '—'}
              {q.dateAccepted && ` · ${dateLabel} ${q.dateAccepted}`}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-ink-faint hover:bg-sunk hover:text-ink-soft"
              aria-label="Sluiten"
            >
              ✕
            </button>
            <div className="flex items-center gap-2 whitespace-nowrap text-xs text-ink-mute">
              <span>
                Dekking:{' '}
                <strong className="text-ink-soft">{formatPercent(q.matchCoverage)}</strong>
              </span>
              {q.verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-good ring-1 ring-good/30">
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
            <p className="mb-1.5 text-xs font-medium text-ink-mute">Vloerregels</p>
            {lines.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-xs">
                  <thead className="bg-sunk text-ink-faint">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Product</th>
                      <th className="px-3 py-1.5 text-right font-medium">M²</th>
                      <th className="px-3 py-1.5 text-right font-medium">Omzet</th>
                      <th className="px-3 py-1.5 text-right font-medium">Marge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hair">
                    {lines.map((l, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5">
                          <span className="rounded bg-sunk px-1.5 py-0.5 font-medium text-ink-soft">
                            {formatProduct(l.code)}
                          </span>
                          {l.desc && (
                            <span className="mt-0.5 block max-w-[16rem] truncate text-[11px] text-ink-faint" title={l.desc}>
                              {l.desc}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-ink-soft">
                          {formatNumber(l.m2)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-ink-soft">
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
                  <p className="border-t border-hair bg-warn-soft/50 px-3 py-1.5 text-xs text-warn">
                    Vul de inkoopprijs (€/m²) in bij regels zonder marge. Wordt in de marges
                    verwerkt bij de eerstvolgende synchronisatie.
                  </p>
                )}
              </div>
            ) : (
              <span className="text-xs text-ink-faint">
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
  className = 'text-ink',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-lg bg-sunk px-3 py-2">
      <div className="text-xs text-ink-faint">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${className}`}>{value}</div>
    </div>
  );
}
