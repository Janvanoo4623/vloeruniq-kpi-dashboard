'use client';

import { useEffect, useState } from 'react';
import { Tag, X } from 'lucide-react';
import type { MissingPrice } from '@/lib/missing-prices';
import type { QuotationRow } from '@/lib/types';
import { formatEuro, formatNumber, formatProduct } from '@/lib/format';
import QuotationModal, { STATUS_LABEL, STATUS_STYLE } from './QuotationModal';

/**
 * Om welke offertes gaat het bij een vloer zonder inkoopprijs.
 *
 * "12 offertes" is een getal waar je niets mee kunt. Voor je een inkoopprijs
 * invult wil je weten wíe het zijn: gaat het om één grote klant uit 2024 of om
 * twaalf lopende offertes? Dat verschil bepaalt of je de prijs opzoekt of de
 * regel als eenmalig afdoet.
 *
 * De volledige offerte wordt pas opgehaald als je erop klikt. Alle offertes
 * meesturen met de lijst zou de pagina onnodig zwaar maken.
 */
export default function MissingPriceModal({
  item,
  onClose,
}: {
  item: MissingPrice;
  onClose: () => void;
}) {
  const [offerte, setOfferte] = useState<QuotationRow | null>(null);
  const [laden, setLaden] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function openOfferte(id: string) {
    setLaden(id);
    setFout(null);
    try {
      const res = await fetch(`/api/quotation?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFout(data.error || 'Offerte laden mislukt.');
        return;
      }
      setOfferte(data.quotation as QuotationRow);
    } catch {
      setFout('Offerte laden mislukt (netwerk).');
    } finally {
      setLaden(null);
    }
  }

  if (offerte) {
    return <QuotationModal q={offerte} onClose={() => setOfferte(null)} />;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_64px_-16px_rgba(28,25,23,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-sunk px-1.5 py-0.5 text-[13px] font-medium text-ink-soft">
                <Tag size={12} strokeWidth={2} className="text-ink-faint" />
                {formatProduct(item.code)}
              </span>
              <h3 className="truncate text-base font-semibold text-ink">zonder inkoopprijs</h3>
            </div>
            <p className="mt-0.5 text-sm text-ink-mute">
              {item.quotationCount} {item.quotationCount === 1 ? 'offerte' : 'offertes'} ·{' '}
              {formatNumber(item.m2)} m² · {formatEuro(item.revenue)} omzet zonder marge, ex btw
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink-faint hover:bg-sunk hover:text-ink-soft"
            aria-label="Sluiten"
          >
            <X size={14} strokeWidth={2.2} />
          </button>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead className="sticky top-0 bg-sunk text-[11px] uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-5 py-2 text-left font-semibold">Klant</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Datum</th>
                <th className="px-3 py-2 text-right font-semibold">m²</th>
                <th className="px-5 py-2 text-right font-semibold">Omzet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hair">
              {item.quotations.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => openOfferte(o.id)}
                  className="cursor-pointer hover:bg-sunk/60"
                >
                  <td className="px-5 py-2.5">
                    <div className="font-medium text-ink">{o.customerName || '—'}</div>
                    <div className="truncate text-[11.5px] text-ink-faint">
                      {o.name}
                      {laden === o.id && ' · laden…'}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${STATUS_STYLE[o.status]}`}
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-faint">{o.date}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                    {formatNumber(o.m2)}
                  </td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-ink">
                    {formatEuro(o.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="border-t border-hair px-5 py-2.5 text-[12px] text-ink-mute">
          {fout ? (
            <span className="text-crit">{fout}</span>
          ) : (
            'Klik een offerte om hem helemaal te bekijken of te corrigeren.'
          )}
        </p>
      </div>
    </div>
  );
}
