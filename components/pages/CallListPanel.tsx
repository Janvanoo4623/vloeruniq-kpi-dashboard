'use client';

import type { CallList } from '@/lib/today';
import { formatEuro, formatPercent } from '@/lib/format';
import { Empty, Panel, cn } from '@/components/ui';
import { Pagination, usePaged } from '@/components/ui/Pagination';
import { useQuotationOpener } from '@/components/overview/parts';

/**
 * De hele belijst: open offertes op volgorde van wat ze waarschijnlijk
 * opleveren (bedrag × de kans dat een offerte van die leeftijd nog wint). Niet
 * op leeftijd, want de oudste is meestal al verloren, en niet op bedrag, want
 * de grootste is niet altijd de kansrijkste.
 */
export default function CallListPanel({ callList, pricedCodes }: { callList: CallList; pricedCodes?: Set<string> }) {
  const { visible, props } = usePaged(callList.items);
  const { open, laden, modal } = useQuotationOpener(pricedCodes);
  const max = Math.max(1, ...callList.items.map((c) => c.expected));

  return (
    <div id="belijst" className="scroll-mt-24">
      <Panel
        title="Belijst"
        subtitle={`Open offertes van minstens vijf dagen, op volgorde van verwachte opbrengst. De kans komt uit ${callList.basis} besliste offertes: hoe vaak een offerte van die leeftijd nog gewonnen werd.`}
        bodyClassName="p-0"
      >
        {callList.items.length === 0 ? (
          <Empty>Geen open offertes om na te bellen.</Empty>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-sunk text-xs text-ink-mute">
                  <tr className="border-b border-line">
                    <th className="px-5 py-2 text-left font-medium">Klant</th>
                    <th className="px-3 py-2 text-right font-medium">Open</th>
                    <th className="px-3 py-2 text-right font-medium">Bedrag</th>
                    <th className="px-3 py-2 text-right font-medium">Kans</th>
                    <th className="px-5 py-2 text-left font-medium">Verwacht</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hair">
                  {visible.map((c) => (
                    <tr
                      key={c.quotationId}
                      onClick={() => open(c.quotationId)}
                      className={cn('cursor-pointer hover:bg-sunk', laden === c.quotationId && 'opacity-60')}
                    >
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-1 text-ink">
                          {c.customerName || '—'} <span className="text-ink-faint">›</span>
                        </div>
                        <div className="max-w-[320px] truncate text-xs text-ink-faint">
                          {c.name}
                          {c.city && ` · ${c.city}`}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-mute">{c.daysOpen} d</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{formatEuro(c.value)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-mute">{formatPercent(c.winChance)}</td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-sunk">
                            <span className="block h-full rounded-full bg-brand" style={{ width: `${(c.expected / max) * 100}%` }} />
                          </span>
                          <span className="tabular-nums text-ink">{formatEuro(c.expected)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination {...props} />
          </>
        )}
      </Panel>
      {modal}
    </div>
  );
}
