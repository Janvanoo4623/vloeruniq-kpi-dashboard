'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import type { ProductSpread } from '@/lib/insights';
import { formatEuro, formatNumber, formatPercent, formatProduct } from '@/lib/format';
import { Empty, Panel, cn } from '@/components/ui';
import { Pagination, usePaged } from '@/components/ui/Pagination';

/**
 * Marge per m² per product, als spreiding in plaats van als gemiddelde.
 *
 * De productentabel hierboven toont al totalen; die zeggen welk product veel
 * omzet doet. Dit paneel beantwoordt een andere vraag: waar geef ik weg. Een
 * product met een nette gemiddelde marge kan bestaan uit een paar goede offertes
 * en een paar waarin flink is gezakt, en dat verschil is precies wat je kunt
 * terugpakken.
 *
 * De balk loopt van de slechtste tot de beste offerte, met een streep op de
 * mediaan. Lange balk = wisselvallig geprijsd. Balk die links van nul begint =
 * er is met verlies verkocht.
 */
export default function ProductSpreadPanel({ products }: { products: ProductSpread[] }) {
  const [sorteer, setSorteer] = useState<'marge' | 'spreiding' | 'omzet'>('marge');

  const gesorteerd = [...products].sort((a, b) => {
    if (sorteer === 'spreiding') return b.downside - a.downside;
    if (sorteer === 'omzet') return b.revenue - a.revenue;
    return a.medianMarginPerM2 - b.medianMarginPerM2;
  });
  const gepagineerd = usePaged(gesorteerd);

  if (products.length === 0) {
    return (
      <Panel title="Marge per product" subtitle="Spreiding in plaats van gemiddelde">
        <Empty>Te weinig offertes per product voor een betrouwbare spreiding.</Empty>
      </Panel>
    );
  }

  // Eén schaal voor alle balken, zodat ze onderling vergelijkbaar zijn.
  const laagste = Math.min(0, ...products.map((p) => p.minMarginPerM2));
  const hoogste = Math.max(...products.map((p) => p.maxMarginPerM2));
  const bereik = Math.max(1, hoogste - laagste);
  const positie = (v: number) => ((v - laagste) / bereik) * 100;

  const verlieslijders = products.filter((p) => p.minMarginPerM2 < 0);

  return (
    <Panel
      title="Waar geef je weg?"
      subtitle="Marge per m² per product — van de slechtste tot de beste offerte, met de mediaan als streep"
      right={
        <div className="flex rounded-lg border border-line p-0.5 text-[11.5px]">
          {(
            [
              ['marge', 'Laagste marge'],
              ['spreiding', 'Grootste spreiding'],
              ['omzet', 'Omzet'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => {
                setSorteer(k);
                gepagineerd.reset();
              }}
              className={cn(
                'rounded-md px-2 py-1 font-medium transition',
                sorteer === k ? 'bg-ink text-white' : 'text-ink-mute hover:text-ink',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-0"
    >
      {verlieslijders.length > 0 && (
        <div className="flex items-start gap-2 border-b border-hair bg-warn-soft px-5 py-3">
          <Info size={14} strokeWidth={2.2} className="mt-0.5 shrink-0 text-warn" />
          <p className="text-[12px] leading-relaxed text-warn">
            Bij {verlieslijders.length}{' '}
            {verlieslijders.length === 1 ? 'product' : 'producten'} is minstens één offerte onder de
            kostprijs verkocht — de balk begint dan links van de nullijn. Alleen zichtbaar bij
            producten met minstens drie offertes; daaronder is een mediaan een toevalstreffer.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-[13px]">
          <thead>
            <tr className="border-b border-hair text-[10.5px] uppercase tracking-wide text-ink-faint">
              <th className="px-5 py-2 text-left font-semibold">Product</th>
              <th className="px-5 py-2 text-right font-semibold">Offertes</th>
              <th className="px-5 py-2 text-right font-semibold">Inkoop</th>
              <th className="px-5 py-2 text-left font-semibold">Marge per m²</th>
              <th className="px-5 py-2 text-right font-semibold">Mediaan</th>
              <th className="px-5 py-2 text-right font-semibold">Marge %</th>
            </tr>
          </thead>
          <tbody>
            {gepagineerd.visible.map((p) => {
              const links = positie(p.minMarginPerM2);
              const rechts = positie(p.maxMarginPerM2);
              const med = positie(p.medianMarginPerM2);
              const verlies = p.minMarginPerM2 < 0;
              return (
                <tr key={p.code} className="border-b border-hair last:border-0 hover:bg-sunk/60">
                  <td className="px-5 py-2.5 font-medium text-ink">{formatProduct(p.code)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">{p.quotes}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-ink-mute">
                    {p.purchasePerM2 == null ? '—' : formatEuro(p.purchasePerM2, true)}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="relative h-5 w-[240px]">
                      {/* Nullijn: links daarvan is verlies. */}
                      <span
                        className="absolute inset-y-0 w-px bg-line"
                        style={{ left: `${positie(0)}%` }}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          'absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full',
                          verlies ? 'bg-warn/35' : 'bg-accent/25',
                        )}
                        style={{ left: `${links}%`, width: `${Math.max(1, rechts - links)}%` }}
                      />
                      <span
                        className={cn(
                          'absolute top-1/2 h-3.5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full',
                          verlies ? 'bg-warn' : 'bg-accent',
                        )}
                        style={{ left: `${med}%` }}
                        title={`mediaan ${formatEuro(p.medianMarginPerM2, true)}/m²`}
                      />
                    </div>
                    <p className="mt-0.5 w-[240px] whitespace-nowrap text-[10.5px] tabular-nums text-ink-faint">
                      {formatEuro(p.minMarginPerM2, true)} tot {formatEuro(p.maxMarginPerM2, true)}
                      {p.downside > 5 && (
                        <span className="ml-2 text-warn" title="afstand tussen de slechtste offerte en de mediaan">
                          −{formatEuro(p.downside, true)} uitschieter
                        </span>
                      )}
                    </p>
                  </td>
                  <td
                    className={cn(
                      'px-5 py-2.5 text-right font-semibold tabular-nums',
                      p.medianMarginPerM2 < 10 ? 'text-warn' : 'text-ink',
                    )}
                  >
                    {formatEuro(p.medianMarginPerM2, true)}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">
                    {formatPercent(p.medianMarginPct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination {...gepagineerd.props} />
      <p className="border-t border-hair px-5 py-3 text-[11.5px] leading-relaxed text-ink-faint">
        {formatNumber(products.length)} producten met minstens drie geaccepteerde offertes. Regels
        onder de 5 m² tellen niet mee: er staat een offerteregel met aantal 1 en €421,60 marge, en
        zo&apos;n €421,60 per m² is geen prijspunt maar een invoerfout. De marge rust verder op de
        inkoopprijs in de kolom ernaast — staat die te hoog of te laag, dan schuift de hele balk mee.
      </p>
    </Panel>
  );
}
