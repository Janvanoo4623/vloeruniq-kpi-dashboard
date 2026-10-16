'use client';

import Link from 'next/link';
import { ArrowRight, Phone } from 'lucide-react';
import type { CallList } from '@/lib/today';
import { formatEuro, formatPercent } from '@/lib/format';
import { Card, cn } from '@/components/ui';
import { Rich, useQuotationOpener } from './parts';

const DAG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MAAND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/**
 * Het dashboard dat praat. Links wat er speelt, in zinnen; rechts wie je
 * vandaag belt. Dat laatste is het enige op Overzicht waar je direct iets mee
 * dóét, dus het staat bovenaan en niet op een pagina die je eerst moet vinden.
 */
export default function Briefing({
  zinnen,
  callList,
  date,
  pricedCodes,
}: {
  zinnen: string[];
  callList: CallList;
  date: string; // YYYY-MM-DD
  pricedCodes?: Set<string>;
}) {
  const { open, laden, modal } = useQuotationOpener(pricedCodes);
  const d = new Date(date + 'T12:00:00Z');
  const kop = `${DAG[d.getUTCDay()]} ${d.getUTCDate()} ${MAAND[d.getUTCMonth()]}`;
  const top = callList.items.slice(0, 4);

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr]">
        <div className="relative px-6 py-6">
          {/* Een dun accent links: dit is de kop van de pagina, geen gewoon paneel. */}
          <span aria-hidden className="absolute inset-y-6 left-0 w-[3px] rounded-r-full bg-accent" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">Vandaag in het kort · {kop}</p>
          <div className="mt-3 space-y-2 text-[14.5px] leading-relaxed text-ink-soft">
            {zinnen.map((z, i) => (
              <p key={i}>
                <Rich text={z} />
              </p>
            ))}
          </div>
        </div>

        <div className="border-t border-hair bg-sunk/50 px-5 py-5 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              <Phone size={12} strokeWidth={2.4} /> Bel vandaag
            </p>
            <Link href="/pijplijn#belijst" className="flex items-center gap-1 text-[11.5px] font-medium text-accent hover:underline">
              Hele lijst <ArrowRight size={12} strokeWidth={2.2} />
            </Link>
          </div>
          {top.length === 0 ? (
            <p className="mt-3 text-[13px] text-ink-faint">Geen open offertes om na te bellen.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {top.map((c) => (
                <li key={c.quotationId}>
                  <button
                    type="button"
                    onClick={() => open(c.quotationId)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2.5 text-left ring-1 ring-line transition hover:ring-ink-faint',
                      laden === c.quotationId && 'opacity-60',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ink">{c.customerName || c.name}</span>
                      <span className="block truncate text-[11.5px] text-ink-mute">
                        {c.daysOpen} dagen open{c.city && ` · ${c.city}`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[13px] font-semibold tabular-nums text-ink">{formatEuro(c.value)}</span>
                      <span className="block text-[11px] tabular-nums text-ink-faint">{formatPercent(c.winChance)} kans</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {modal}
    </Card>
  );
}
