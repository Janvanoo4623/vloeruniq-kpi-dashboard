'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CircleCheck,
  Percent,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { BriefingKind, BriefingLine } from '@/lib/briefing';
import type { CallList } from '@/lib/today';
import { formatEuro, formatPercent } from '@/lib/format';
import { cn } from '@/components/ui';
import { Rich, useQuotationOpener } from './parts';

/**
 * De kaartvorm van het nieuwe Overzicht: geen rand, grote hoeken, een heel
 * zachte schaduw. Alles op deze pagina deelt hem, zodat het één familie is.
 */
export const BENTO =
  'rounded-[28px] bg-surface shadow-[0_1px_2px_rgba(19,19,19,0.04),0_18px_44px_-28px_rgba(19,19,19,0.28)]';

/** Rond knopje met ↗, rechtsboven in een kaart: "hier is meer". */
export function OpenLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunk text-ink-soft transition hover:bg-night hover:text-white"
    >
      <ArrowUpRight size={16} />
    </Link>
  );
}

/** Rond icoon op een zachte achtergrond. */
export function IconBadge({ Icon, tone = 'neutral' }: { Icon: LucideIcon; tone?: 'neutral' | 'brand' | 'warn' | 'crit' }) {
  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
        tone === 'neutral' && 'bg-sunk text-ink-soft',
        tone === 'brand' && 'bg-brand-soft text-brand-ink',
        tone === 'warn' && 'bg-warn-soft text-warn',
        tone === 'crit' && 'bg-crit-soft text-crit',
      )}
    >
      <Icon size={16} strokeWidth={2} />
    </span>
  );
}

const ICOON: Record<BriefingKind, { Icon: LucideIcon; tone: 'neutral' | 'brand' | 'warn' | 'crit' }> = {
  up: { Icon: TrendingUp, tone: 'brand' },
  down: { Icon: TrendingDown, tone: 'warn' },
  flat: { Icon: CalendarDays, tone: 'neutral' },
  goal: { Icon: Target, tone: 'neutral' },
  'margin-up': { Icon: Percent, tone: 'brand' },
  'margin-flat': { Icon: Percent, tone: 'neutral' },
  'margin-down': { Icon: Percent, tone: 'warn' },
  breakeven: { Icon: Scale, tone: 'neutral' },
  'breakeven-ok': { Icon: CircleCheck, tone: 'brand' },
  overdue: { Icon: AlertTriangle, tone: 'crit' },
};

export function BriefCard({ zinnen }: { zinnen: BriefingLine[] }) {
  return (
    <div className={cn(BENTO, 'h-full p-6')}>
      <h3 className="text-[16px] font-semibold tracking-tight text-ink">In het kort</h3>
      <ul className="mt-5 space-y-4">
        {zinnen.map((z, i) => {
          const { Icon, tone } = ICOON[z.kind];
          return (
            <li key={i} className="flex items-start gap-3">
              <IconBadge Icon={Icon} tone={tone} />
              <p className="pt-[7px] text-[13.5px] leading-relaxed text-ink-soft">
                <Rich text={z.text} />
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Initialen-avatars in zachte tinten uit het palet, vast per naam.
const TINTEN = [
  'bg-brand-soft text-brand-ink',
  'bg-oak-soft text-oak',
  'bg-accent-soft text-accent',
  'bg-[#eceaf6] text-[#5f6ea0]',
  'bg-sunk text-ink-soft',
];
function initialen(naam: string): string {
  const delen = naam.replace(/[^\p{L}\s-]/gu, '').trim().split(/\s+/).filter(Boolean);
  if (delen.length === 0) return '?';
  return (delen[0][0] + (delen.length > 1 ? delen[delen.length - 1][0] : '')).toUpperCase();
}
function tint(naam: string): string {
  let h = 0;
  for (const c of naam) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTEN[h % TINTEN.length];
}

export function CallCard({ callList, pricedCodes }: { callList: CallList; pricedCodes?: Set<string> }) {
  const { open, laden, modal } = useQuotationOpener(pricedCodes);
  const top = callList.items.slice(0, 4);
  return (
    <div className={cn(BENTO, 'h-full p-6')}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[16px] font-semibold tracking-tight text-ink">Bel vandaag</h3>
        <OpenLink href="/pijplijn#belijst" label="Hele belijst" />
      </div>
      {top.length === 0 ? (
        <p className="mt-5 text-[13px] text-ink-faint">Geen open offertes om na te bellen.</p>
      ) : (
        <ul className="mt-4 space-y-1">
          {top.map((c) => {
            const naam = c.customerName || c.name;
            return (
              <li key={c.quotationId}>
                <button
                  type="button"
                  onClick={() => open(c.quotationId)}
                  className={cn(
                    '-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-sunk',
                    laden === c.quotationId && 'opacity-60',
                  )}
                >
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold', tint(naam))}>
                    {initialen(naam)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{naam}</span>
                    <span className="block truncate text-[11.5px] text-ink-faint">
                      {c.daysOpen} dagen open{c.city && ` · ${c.city}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13.5px] font-semibold tabular-nums text-ink">{formatEuro(c.value)}</span>
                    <span className="mt-0.5 inline-block rounded-full bg-sunk px-1.5 py-px text-[10.5px] font-medium tabular-nums text-ink-mute">
                      {formatPercent(Math.round(c.winChance))}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {modal}
    </div>
  );
}

/**
 * Tegel in de nieuwe stijl: icoon, label en ↗ bovenaan, een groot licht getal,
 * het verschil als pil, en onderin twaalf pilstaafjes (de laatste in merkgroen).
 */
export function StatTile({
  Icon,
  label,
  href,
  value,
  delta,
  deltaLabel,
  bars,
  sub,
}: {
  Icon: LucideIcon;
  label: string;
  href?: string;
  value: ReactNode;
  delta?: ReactNode;
  deltaLabel?: string;
  bars?: number[];
  sub?: string;
}) {
  const max = Math.max(1, ...(bars ?? []));
  return (
    <div className={cn(BENTO, 'flex flex-col p-5')}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <IconBadge Icon={Icon} />
          <span className="truncate text-[13.5px] font-medium text-ink-soft">{label}</span>
        </span>
        {href && <OpenLink href={href} label={`Naar ${label.toLowerCase()}`} />}
      </div>
      <p className="mt-5 text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink">{value}</p>
      {(delta || deltaLabel) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-faint">
          {delta}
          {deltaLabel && <span>{deltaLabel}</span>}
        </div>
      )}
      {sub && <p className="mt-1.5 text-[11.5px] leading-snug text-ink-faint">{sub}</p>}
      {bars && bars.length > 0 && (
      <div className="mt-auto flex h-10 items-end gap-[3px] pt-5" aria-hidden>
        {bars.map((b, i) => {
          const laatste = i === bars.length - 1;
          return (
            <span
              key={i}
              className={cn('flex-1 rounded-t-[4px] rounded-b-[1px]', laatste ? 'bg-brand' : 'bg-[#e6e2db]')}
              style={{ height: `${Math.max(4, (Math.max(0, b) / max) * 100)}%` }}
            />
          );
        })}
      </div>
      )}
    </div>
  );
}

export type InsightTone = 'neutral' | 'brand' | 'warn' | 'crit';
export interface Insight {
  Icon: LucideIcon;
  tone?: InsightTone;
  /** Tekst; getallen tussen **…** worden vet. */
  text: string;
}

/**
 * "In het kort" voor elke pagina: twee tot vier regels met een rond icoon.
 * De pagina bepaalt zelf wat erin staat; dit is alleen de vorm.
 */
export function InsightCard({ title = 'In het kort', items, footer }: { title?: string; items: Insight[]; footer?: ReactNode }) {
  return (
    <div className={cn(BENTO, 'flex h-full flex-col p-6')}>
      <h3 className="text-[16px] font-semibold tracking-tight text-ink">{title}</h3>
      <ul className="mt-5 space-y-4">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3">
            <IconBadge Icon={it.Icon} tone={it.tone ?? 'neutral'} />
            <p className="pt-[7px] text-[13.5px] leading-relaxed text-ink-soft">
              <Rich text={it.text} />
            </p>
          </li>
        ))}
      </ul>
      {footer && <div className="mt-auto pt-5">{footer}</div>}
    </div>
  );
}

/** Kop boven het detailgedeelte van een pagina: alles hieronder is verdieping. */
export function DetailsLabel({ children = 'Verdieping' }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-4">
      <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{children}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
