'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CircleCheck,
  Percent,
  Phone,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { CallList } from '@/lib/today';
import type { BriefingKind, BriefingLine } from '@/lib/briefing';
import { formatEuro, formatPercent, timeAgo } from '@/lib/format';
import { Card, cn } from '@/components/ui';
import { Rich, useQuotationOpener } from './parts';

/**
 * Eén icoon per soort zin. Grijs, zoals de tekst: het icoon helpt scannen, het
 * is geen oordeel. Alleen waar de zin zelf een waarschuwing is (te laat
 * betaald, marge zakt) krijgt het icoon de signaalkleur.
 */
const ICOON: Record<BriefingKind, { Icon: LucideIcon; tone?: 'warn' | 'good' }> = {
  up: { Icon: TrendingUp },
  down: { Icon: TrendingDown },
  flat: { Icon: CalendarDays },
  goal: { Icon: Target },
  'margin-up': { Icon: Percent },
  'margin-flat': { Icon: Percent },
  'margin-down': { Icon: Percent, tone: 'warn' },
  breakeven: { Icon: Scale },
  'breakeven-ok': { Icon: CircleCheck, tone: 'good' },
  overdue: { Icon: AlertTriangle, tone: 'warn' },
};

/**
 * Goedemorgen/-middag/-avond op de klok van wie kijkt. De server kent die klok
 * niet; useSyncExternalStore geeft daar de neutrale groet en in de browser de
 * echte, zonder hydratiefout.
 */
const geenAbonnement = () => () => {};
function useGroet(): string {
  return useSyncExternalStore(
    geenAbonnement,
    () => {
      const uur = new Date().getHours();
      return uur < 6 ? 'Goedenacht' : uur < 12 ? 'Goedemorgen' : uur < 18 ? 'Goedemiddag' : 'Goedenavond';
    },
    () => 'Goedendag',
  );
}

/** "Live" alleen als de data van vandaag is (de cron draait twee keer per dag). */
function useVers(lastSyncAt: string | null): boolean {
  return useSyncExternalStore(
    geenAbonnement,
    () => lastSyncAt != null && Date.now() - Date.parse(lastSyncAt) < 14 * 3600 * 1000,
    () => true,
  );
}

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
  lastSyncAt,
  pricedCodes,
  children,
}: {
  zinnen: BriefingLine[];
  callList: CallList;
  date: string; // YYYY-MM-DD
  /** Laatste sync met Teamleader: bepaalt of het label "Live" mag heten. */
  lastSyncAt: string | null;
  pricedCodes?: Set<string>;
  /** Komt onder de zinnen: de lopende maand (MonthGoal). */
  children?: React.ReactNode;
}) {
  const { open, laden, modal } = useQuotationOpener(pricedCodes);
  const groet = useGroet();
  // Niet vers? Dan eerlijk zeggen hoe oud de data is in plaats van "Live".
  const vers = useVers(lastSyncAt);
  const d = new Date(date + 'T12:00:00Z');
  const kop = `${DAG[d.getUTCDay()]} ${d.getUTCDate()} ${MAAND[d.getUTCMonth()]}`;
  const top = callList.items.slice(0, 4);

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr]">
        <div className="relative px-6 py-6">
          {/* Een dun accent links: dit is de kop van de pagina, geen gewoon paneel. */}
          <span aria-hidden className="absolute inset-y-6 left-0 w-[3px] rounded-r-full bg-accent" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[20px] font-bold tracking-tight text-ink">{groet}</h2>
              <p className="mt-0.5 text-[12px] text-ink-faint">{kop.charAt(0).toUpperCase() + kop.slice(1)}</p>
            </div>
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset',
                vers ? 'bg-good-soft text-good ring-good/20' : 'bg-warn-soft text-warn ring-warn/20',
              )}
              title={lastSyncAt ? `Laatst bijgewerkt ${timeAgo(lastSyncAt)}` : 'Nog nooit bijgewerkt'}
            >
              <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', vers ? 'bg-good' : 'bg-warn')}>
                {vers && <span className="absolute inset-0 animate-ping rounded-full bg-good/60" />}
              </span>
              {vers ? 'Live' : `Bijgewerkt ${timeAgo(lastSyncAt)}`}
            </span>
          </div>
          <ul className="mt-4 space-y-2.5">
            {zinnen.map((z, i) => {
              const { Icon, tone } = ICOON[z.kind];
              return (
                <li key={i} className="flex items-start gap-3 text-[14px] leading-relaxed text-ink-soft">
                  <span
                    className={cn(
                      'mt-[3px] shrink-0',
                      tone === 'warn' ? 'text-warn' : tone === 'good' ? 'text-good' : 'text-ink-faint',
                    )}
                  >
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  <span>
                    <Rich text={z.text} />
                  </span>
                </li>
              );
            })}
          </ul>
          {children && <div className="mt-5 border-t border-hair pt-5">{children}</div>}
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
