'use client';

import { Info } from 'lucide-react';
import type { MarketShareOverview } from '@/lib/market-share';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { Empty, Panel, cn } from '@/components/ui';

const maandLabel = (m: string) => {
  const [j, mm] = m.split('-');
  return `${['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'][Number(mm) - 1]} ${j}`;
};

/**
 * Eigen offertes afgezet tegen verhuisbewegingen uit CBS. Niet om te zien waar de
 * omzet zit — dat weet je al — maar waar je ondervertegenwoordigd bent.
 *
 * De maat is een verhouding, geen echt marktaandeel: niet elke verhuizer koopt een
 * vloer en niet elke vloerklant verhuist. Bruikbaar om gemeenten ONDERLING te
 * vergelijken, nooit als absoluut percentage. Dat staat er daarom bij.
 */
export default function MarktaandeelPanel({ data }: { data: MarketShareOverview }) {
  const { rows, cbsThrough, from, to } = data;

  if (rows.length === 0 || !cbsThrough) {
    return (
      <Panel title="Marktaandeel per gemeente" subtitle="Offertes afgezet tegen verhuizingen (CBS)">
        <Empty>CBS-cijfers zijn nu niet beschikbaar.</Empty>
      </Panel>
    );
  }

  const gerangschikt = rows.filter((r) => r.perThousand != null);
  const beste = gerangschikt[0];
  const max = Math.max(1, ...gerangschikt.map((r) => r.perThousand ?? 0));

  return (
    <Panel
      title="Marktaandeel per gemeente"
      subtitle={`Eigen offertes afgezet tegen verhuisbewegingen — ${from} t/m ${to}`}
      right={
        <span className="text-[11px] text-ink-faint">CBS t/m {maandLabel(cbsThrough)}</span>
      }
      bodyClassName="p-0"
    >
      <div className="border-b border-hair px-5 py-3">
        <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-mute">
          <Info size={14} strokeWidth={2.2} className="mt-0.5 shrink-0 text-accent" />
          <span>
            Wie verhuist koopt een vloer, dus het aantal verhuizingen is een maat voor de vraag in
            een gemeente. <strong>Dit is een verhouding, geen echt marktaandeel</strong> — niet elke
            verhuizer koopt een vloer. Gebruik het om gemeenten <em>onderling</em> te vergelijken.
            {beste && (
              <>
                {' '}
                In {beste.gemeente} sta je op {formatNumber(beste.perThousand)} offertes per 1.000
                verhuizingen; alles wat daar ver onder zit is ruimte.
              </>
            )}
          </span>
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-b border-hair text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="px-5 py-2.5 text-left font-semibold">Gemeente</th>
              <th className="px-5 py-2.5 text-left font-semibold">Offertes per 1.000 verhuizingen</th>
              <th className="px-5 py-2.5 text-right font-semibold">Offertes</th>
              <th className="px-5 py-2.5 text-right font-semibold">Winkans</th>
              <th className="px-5 py-2.5 text-right font-semibold">Verhuizingen</th>
              <th className="px-5 py-2.5 text-right font-semibold">Omzet</th>
              <th className="px-5 py-2.5 text-right font-semibold">€ per verhuizing</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const laag = r.perThousand != null && beste?.perThousand != null
                && r.perThousand < beste.perThousand * 0.35;
              return (
                <tr key={r.code} className="border-b border-hair last:border-0 hover:bg-sunk/60">
                  <td className="px-5 py-2.5">
                    <span className="font-medium text-ink">{r.gemeente}</span>
                    {r.plaatsen.length > 1 && (
                      <span className="ml-2 text-[11px] text-ink-faint">
                        {r.plaatsen.join(', ')}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2.5">
                    {r.perThousand == null ? (
                      <span className="text-[12px] text-ink-faint">te weinig verhuizingen</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="w-[42px] shrink-0 text-right font-semibold tabular-nums text-ink">
                          {formatNumber(r.perThousand)}
                        </span>
                        <span className="h-1.5 w-[110px] shrink-0 overflow-hidden rounded-full bg-sunk">
                          <span
                            className={cn('block h-full rounded-full', laag ? 'bg-warn' : 'bg-accent')}
                            style={{ width: `${((r.perThousand ?? 0) / max) * 100}%` }}
                          />
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">{r.quotes}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-ink-mute">
                    {formatPercent(r.winRate)}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-ink-mute">
                    {formatNumber(r.moves)}
                  </td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-ink">
                    {formatEuro(r.revenue)}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">
                    {r.revenuePerMove == null ? '—' : formatEuro(r.revenuePerMove, true)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-hair px-5 py-3 text-[11.5px] text-ink-faint">
        Bron: CBS StatLine 84547NED, verhuisde personen per gemeente per maand. Plaatsen zijn
        samengevoegd tot gemeenten — Rijssen en Holten zijn sinds 2001 één gemeente, Bathmen hoort
        bij Deventer.
      </p>
    </Panel>
  );
}
