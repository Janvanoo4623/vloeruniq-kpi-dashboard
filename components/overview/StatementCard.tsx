'use client';

import Link from 'next/link';
import { ArrowUpRight, Pencil } from 'lucide-react';
import type { MonthProgress } from '@/lib/today';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import CountUp from '@/components/CountUp';
import { HERO_THEME } from '@/components/page/HeroCard';
import { cn } from '@/components/ui';

const MAAND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/**
 * De statement-kaart: de lopende maand, in het zwart van het logo met het
 * merkgroen als enige kleur. Dit is het ene getal waar Overzicht om draait;
 * daarom mag hij als enige kaart vol gekleurd zijn.
 *
 * Het patroon rechtsboven is een visgraat, heel zacht — de vloer waar het
 * bedrijf het meest van verkoopt.
 */
export default function StatementCard({ month, onGoal }: { month: MonthProgress; onGoal: () => void }) {
  const naam = MAAND[Number(month.month.slice(5, 7)) - 1];
  const verstreken = month.day / month.daysInMonth;
  const doel = month.goals.revenue;
  const maat = doel ?? (month.prevTotal.revenue || null);
  const aandeel = maat ? month.revenue / maat : null;
  const status = aandeel == null ? null : aandeel >= verstreken + 0.05 ? 'loopt voor' : aandeel <= verstreken - 0.1 ? 'loopt achter' : 'op schema';

  const klein = [
    { label: 'Marge', value: formatEuro(month.margin), prev: month.prevTotal.margin, cur: month.margin, goal: month.goals.margin },
    { label: 'Verkochte m²', value: `${formatNumber(month.m2)} m²`, prev: month.prevTotal.m2, cur: month.m2, goal: month.goals.m2 },
  ];

  return (
    <div data-hero={HERO_THEME} className="hero relative h-full overflow-hidden rounded-[28px] p-7">
      {/* Visgraat en een zachte groene gloed, puur sfeer. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rotate-12 opacity-[var(--hero-pattern-opacity)]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, var(--hero-pattern) 0 2px, transparent 2px 22px), repeating-linear-gradient(-45deg, var(--hero-pattern) 0 2px, transparent 2px 22px)',
          maskImage: 'radial-gradient(circle at 70% 30%, #000 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle at 70% 30%, #000 0%, transparent 70%)',
        }}
      />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[color:var(--hero-glow)] blur-3xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-[color:var(--hero-muted)]">
            {naam.charAt(0).toUpperCase() + naam.slice(1)} · dag {month.day} van {month.daysInMonth}
          </span>
          {status && (
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold',
                status === 'loopt voor' && 'bg-[color:var(--hero-good-bg)] text-[color:var(--hero-good-fg)]',
                status === 'loopt achter' && 'bg-warn/20 text-[color:var(--hero-warn)]',
                status === 'op schema' && 'bg-[color:var(--hero-track)] text-[color:var(--hero-soft)]',
              )}
            >
              {status}
            </span>
          )}
        </div>
        <Link
          href="/trends"
          aria-label="Naar trends"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--hero-track)] text-[color:var(--hero-fg)] transition hover:opacity-80"
        >
          <ArrowUpRight size={17} />
        </Link>
      </div>

      <p className="relative mt-6 text-[13px] text-[color:var(--hero-muted)]">Omzet geaccepteerd</p>
      <p className="relative mt-1 text-[46px] font-semibold leading-none tracking-[-0.035em] tabular-nums">
        <CountUp value={month.revenue} format={(v) => formatEuro(v)} />
      </p>

      <div className="relative mt-6">
        <div className="relative h-2.5 w-full rounded-full bg-[color:var(--hero-track)]">
          <span
            className="block h-full rounded-full bg-[color:var(--hero-fill)] transition-[width] duration-700 ease-out"
            style={{ width: `${Math.min(100, (aandeel ?? 0) * 100)}%` }}
          />
          <span
            aria-hidden
            title="Hier zou je staan bij een gelijkmatig tempo"
            className="absolute top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-[color:var(--hero-marker)]"
            style={{ left: `${verstreken * 100}%` }}
          />
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-3 text-[12px] text-[color:var(--hero-muted)]">
          <span>
            {doel
              ? `${formatPercent(Math.round((aandeel ?? 0) * 100))} van het doel van ${formatEuro(doel)}`
              : `${formatEuro(month.prevSameDay.revenue)} op deze dag vorige maand`}
          </span>
          <button type="button" onClick={onGoal} className="flex items-center gap-1 text-[color:var(--hero-soft)] transition hover:text-[color:var(--hero-fg)]">
            <Pencil size={11} /> {doel ? 'Doel' : 'Doel instellen'}
          </button>
        </div>
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-3">
        {klein.map((k) => {
          const ref = k.goal ?? (k.prev || null);
          const a = ref ? k.cur / ref : null;
          return (
            <div key={k.label} className="rounded-2xl bg-[color:var(--hero-surface)] px-4 py-3">
              <p className="text-[12px] text-[color:var(--hero-muted)]">{k.label}</p>
              <p className="mt-0.5 text-[20px] font-semibold tracking-tight tabular-nums">{k.value}</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-[color:var(--hero-track)]">
                <span className="block h-full rounded-full bg-[color:var(--hero-fill)]" style={{ width: `${Math.min(100, (a ?? 0) * 100)}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] text-[color:var(--hero-faint)]">
                {k.goal ? 'van het doel' : 'van vorige maand'} {a != null ? formatPercent(Math.round(a * 100)) : '—'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
