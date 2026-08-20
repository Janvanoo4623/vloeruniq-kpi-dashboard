'use client';

import { useState } from 'react';
import type { RegionInsight } from '@/lib/insights';
import type { MarketShareOverview } from '@/lib/market-share';
import MarktaandeelPanel from './MarktaandeelPanel';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { Empty, Panel, SectionLabel, cn } from '@/components/ui';
import { Pagination } from '@/components/ui/Pagination';
import KpiCard from '@/components/KpiCard';

type SortKey = 'revenue' | 'winRate' | 'marginPct' | 'quotes';

/**
 * Waar win je makkelijk én verdien je goed? De bestaande regiolijst toonde alleen
 * omzet, wat de vraag "is die plaats de rit waard" niet beantwoordt.
 *
 * Plaatsen met te weinig offertes krijgen geen percentage. Ze verdwijnen niet uit
 * de lijst — dat zou omzet verstoppen — maar tonen een streepje, zodat zichtbaar
 * blijft dát ze er zijn zonder een cijfer te suggereren dat er niet is.
 */
export default function RegioView({
  regions,
  minSample,
  marketShare,
}: {
  regions: RegionInsight[];
  minSample: number;
  marketShare: MarketShareOverview;
}) {
  const [sort, setSort] = useState<SortKey>('revenue');
  const [page, setPage] = useState(0);
  const PER_PAGE = 20;

  if (regions.length === 0) {
    return (
      <Panel title="Regio" subtitle="Winkans en marge per plaats">
        <Empty>Geen plaatsgegevens.</Empty>
      </Panel>
    );
  }

  const rated = regions.filter((r) => r.winRate != null);
  const sorted = [...regions].sort((a, b) => {
    const av = a[sort] ?? -1;
    const bv = b[sort] ?? -1;
    return (bv as number) - (av as number);
  });
  const pageCount = Math.ceil(sorted.length / PER_PAGE);
  const zichtbaar = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const totalRevenue = regions.reduce((s, r) => s + r.revenue, 0);
  const best = [...rated].sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))[0];
  const worst = [...rated].sort((a, b) => (a.winRate ?? 0) - (b.winRate ?? 0))[0];
  const bestMargin = [...rated]
    .filter((r) => r.marginPct != null)
    .sort((a, b) => (b.marginPct ?? 0) - (a.marginPct ?? 0))[0];

  const maxWin = Math.max(1, ...rated.map((r) => r.winRate ?? 0));

  return (
    <div className="space-y-6">
      <section>
        <SectionLabel>Over alle offertes, niet alleen de gekozen periode</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Plaatsen"
            value={String(regions.length)}
            sub={`${rated.length} met minimaal ${minSample} offertes`}
          />
          <KpiCard
            label="Beste winkans"
            value={best ? formatPercent(best.winRate) : '—'}
            sub={best ? `${best.name} · ${best.won} van ${best.quotes}` : undefined}
          />
          <KpiCard
            label="Laagste winkans"
            value={worst ? formatPercent(worst.winRate) : '—'}
            sub={worst ? `${worst.name} · ${worst.won} van ${worst.quotes}` : undefined}
            higherIsBetter={false}
          />
          <KpiCard
            label="Beste marge"
            value={bestMargin ? formatPercent(bestMargin.marginPct) : '—'}
            sub={bestMargin ? bestMargin.name : undefined}
          />
        </div>
      </section>

      <MarktaandeelPanel data={marketShare} />

      <Panel
        title="Winkans en marge per plaats"
        subtitle={`Een percentage verschijnt pas vanaf ${minSample} uitgewerkte offertes — daaronder zegt het niets`}
        right={
          <div className="flex rounded-lg border border-line p-0.5 text-[11.5px]">
            {(
              [
                ['revenue', 'Omzet'],
                ['winRate', 'Winkans'],
                ['marginPct', 'Marge'],
                ['quotes', 'Aantal'],
              ] as [SortKey, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => {
                  setSort(k);
                  setPage(0);
                }}
                className={cn(
                  'rounded-md px-2 py-1 font-medium transition',
                  sort === k ? 'bg-ink text-white' : 'text-ink-mute hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-[13px]">
            <thead>
              <tr className="border-b border-hair text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="px-5 py-2.5 text-left font-semibold">Plaats</th>
                <th className="px-5 py-2.5 text-left font-semibold">Winkans</th>
                <th className="px-5 py-2.5 text-right font-semibold">Offertes</th>
                <th className="px-5 py-2.5 text-right font-semibold">Marge</th>
                <th className="px-5 py-2.5 text-right font-semibold">m²</th>
                <th className="px-5 py-2.5 text-right font-semibold">Omzet</th>
              </tr>
            </thead>
            <tbody>
              {zichtbaar.map((r) => (
                <tr key={r.name} className="border-b border-hair last:border-0 hover:bg-sunk/60">
                  <td className="px-5 py-2.5 font-medium text-ink">{r.name}</td>
                  <td className="px-5 py-2.5">
                    {r.winRate == null ? (
                      <span className="text-[12px] text-ink-faint">te weinig offertes</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="w-[46px] shrink-0 text-right font-semibold tabular-nums text-ink">
                          {formatPercent(r.winRate)}
                        </span>
                        <span className="h-1.5 w-[90px] shrink-0 overflow-hidden rounded-full bg-sunk">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${((r.winRate ?? 0) / maxWin) * 100}%` }}
                          />
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-ink-mute">
                    {r.won}/{r.quotes}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">
                    {formatPercent(r.marginPct)}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-ink-mute">
                    {formatNumber(r.m2)}
                  </td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-ink">
                    {formatEuro(r.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageCount={pageCount}
          total={sorted.length}
          perPage={PER_PAGE}
          onChange={setPage}
        />
        <p className="border-t border-hair px-5 py-3 text-[11.5px] text-ink-faint">
          Totaal {formatEuro(totalRevenue)} over {regions.length} plaatsen. Schrijfwijzen zijn
          samengevoegd — &ldquo;ALMELO&rdquo; en &ldquo;almelo&rdquo; tellen als één plaats.
        </p>
      </Panel>
    </div>
  );
}
