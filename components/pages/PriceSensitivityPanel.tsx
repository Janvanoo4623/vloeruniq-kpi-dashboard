'use client';

import { useState } from 'react';
import type { PriceSensitivity } from '@/lib/price-sensitivity';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { Panel, cn } from '@/components/ui';
import { Pagination, usePaged } from '@/components/ui/Pagination';

const STAPPEN = [0.5, 1, 2, 3];

/**
 * "Wat als we een euro per m² meer vragen?" Het antwoord is rekenkundig simpel
 * (m² × stap), het oordeel niet — daarom staat de winkans van duurdere en
 * goedkopere offertes er direct naast. Dat is geen bewijs, wel het beste wat de
 * eigen historie zegt.
 */
export default function PriceSensitivityPanel({ data }: { data: PriceSensitivity }) {
  const [stap, setStap] = useState(1);
  const extra = data.m2Total * stap;
  const nieuweMarge = data.marginTotal + extra;
  const { visible, props } = usePaged(data.products);
  const { cheaper, pricier, medianPrice, sample } = data.winRate;
  const ruimte = cheaper != null && pricier != null ? pricier - cheaper : null;

  return (
    <Panel
      title="Wat als de prijs per m² iets omhoog gaat?"
      subtitle="Over de gewonnen offertes van de afgelopen twaalf maanden, ex btw"
      right={
        <div className="flex rounded-full bg-sunk p-1 text-[12px]">
          {STAPPEN.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStap(s)}
              className={cn('rounded-full px-2.5 py-1 font-medium tabular-nums transition', stap === s ? 'bg-night text-white shadow-sm' : 'text-ink-mute hover:text-ink')}
            >
              +{formatEuro(s, s % 1 !== 0)}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-0"
    >
      <div className="grid gap-6 px-5 py-5 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-[12px] font-medium text-ink-mute">Extra marge per jaar bij +{formatEuro(stap, stap % 1 !== 0)} per m²</p>
          <p className="mt-1 text-[40px] font-bold leading-none tracking-tight tabular-nums text-ink">{formatEuro(extra)}</p>
          <p className="mt-2 text-[12.5px] text-ink-mute">
            {formatNumber(data.m2Total)} m² verkocht · marge van {formatEuro(data.marginTotal)} naar {formatEuro(nieuweMarge)}
            {data.marginTotal > 0 && ` (+${formatPercent(Math.round((extra / data.marginTotal) * 1000) / 10)})`}
          </p>
        </div>
        <div className="rounded-xl bg-sunk px-4 py-3">
          <p className="text-[12px] font-medium text-ink-mute">Kost een hogere prijs opdrachten?</p>
          {cheaper != null && pricier != null ? (
            <>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[20px] font-semibold tabular-nums text-ink">{formatPercent(cheaper)}</p>
                  <p className="text-[11.5px] text-ink-faint">winkans onder {formatEuro(medianPrice, true)}/m²</p>
                </div>
                <div>
                  <p className="text-[20px] font-semibold tabular-nums text-ink">{formatPercent(pricier)}</p>
                  <p className="text-[11.5px] text-ink-faint">winkans vanaf {formatEuro(medianPrice, true)}/m²</p>
                </div>
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-ink-mute">
                {ruimte != null && ruimte >= -3
                  ? 'Duurdere offertes worden niet minder vaak gewonnen. Dat wijst op ruimte in de prijs.'
                  : 'Duurdere offertes worden duidelijk minder vaak gewonnen. Een prijsstap kost hier waarschijnlijk opdrachten.'}{' '}
                Over {sample} besliste offertes; prijs en product hangen samen, dus lees het als richting, niet als bewijs.
              </p>
            </>
          ) : (
            <p className="mt-2 text-[12px] text-ink-faint">Te weinig besliste offertes om iets over de winkans te zeggen.</p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border-t border-hair">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-sunk text-xs text-ink-mute">
            <tr className="border-b border-line">
              <th className="px-5 py-2 text-left font-medium">Product</th>
              <th className="px-3 py-2 text-right font-medium">m²</th>
              <th className="px-3 py-2 text-right font-medium">Prijs / m²</th>
              <th className="px-3 py-2 text-right font-medium">Marge / m²</th>
              <th className="px-5 py-2 text-right font-medium">Extra per jaar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {visible.map((p) => (
              <tr key={p.code}>
                <td className="max-w-[320px] truncate px-5 py-2.5 text-ink">{p.label}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{formatNumber(p.m2)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                  {formatEuro(p.pricePerM2, true)} <span className="text-ink-faint">→ {formatEuro(p.pricePerM2 + stap, true)}</span>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">
                  {p.marginPerM2 != null ? (
                    <>
                      {formatEuro(p.marginPerM2, true)} <span className="text-ink-faint">→ {formatEuro(p.marginPerM2 + stap, true)}</span>
                    </>
                  ) : (
                    <span className="text-ink-faint">geen inkoopprijs</span>
                  )}
                </td>
                <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-ink">{formatEuro(p.m2 * stap)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination {...props} />
      </div>
    </Panel>
  );
}
