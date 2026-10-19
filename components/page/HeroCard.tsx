'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import CountUp from '@/components/CountUp';
import { cn } from '@/components/ui';

export type HeroTone = 'good' | 'warn' | 'crit' | 'neutral';

/** Kleur van alle statement-kaarten (zie .hero in globals.css). */
export type HeroTheme = 'night' | 'mint' | 'green';
export const HERO_THEME: HeroTheme = 'mint';

/**
 * De zwarte statement-kaart, voor elke pagina. Eén kerngetal, groot; erboven
 * een label en eventueel een status-pil; eronder één regel duiding en
 * optioneel een balk en twee subcijfers. Het visgraatpatroon en de groene gloed
 * zijn dezelfde als op Overzicht, zodat het herkenbaar één familie is.
 */
export default function HeroCard({
  label,
  value,
  format,
  tone,
  status,
  sub,
  progress,
  children,
  href,
  hrefLabel,
  valueTone,
}: {
  label: string;
  value: number;
  format: (v: number) => string;
  /** Kleur van de status-pil. */
  tone?: HeroTone;
  status?: string;
  sub?: ReactNode;
  /** 0–1, met optioneel een streepje waar je "zou moeten staan". */
  progress?: { value: number; marker?: number; label?: ReactNode; right?: ReactNode; tone?: 'brand' | 'neutral' };
  /** Subcijfers onderin (MiniStat). */
  children?: ReactNode;
  href?: string;
  hrefLabel?: string;
  /** Het getal zelf rood kleuren (bv. een verlies of een tekort). */
  valueTone?: 'crit';
}) {
  return (
    <div data-hero={HERO_THEME} className="hero relative h-full overflow-hidden rounded-[28px] p-7">
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
      <div
        aria-hidden
        className={cn('pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full blur-3xl', 'bg-[color:var(--hero-glow)]')}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-[color:var(--hero-muted)]">{label}</span>
          {status && (
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold',
                tone === 'good' && 'bg-[color:var(--hero-good-bg)] text-[color:var(--hero-good-fg)]',
                tone === 'warn' && 'bg-warn/20 text-[color:var(--hero-warn)]',
                tone === 'crit' && 'bg-crit/20 text-[color:var(--hero-crit)]',
                (!tone || tone === 'neutral') && 'bg-[color:var(--hero-track)] text-[color:var(--hero-soft)]',
              )}
            >
              {status}
            </span>
          )}
        </div>
        {href && (
          <Link
            href={href}
            aria-label={hrefLabel}
            title={hrefLabel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--hero-track)] text-[color:var(--hero-fg)] transition hover:opacity-80"
          >
            <ArrowUpRight size={17} />
          </Link>
        )}
      </div>

      <p className={cn('relative mt-6 text-[46px] font-semibold leading-none tracking-[-0.035em] tabular-nums', valueTone === 'crit' && 'text-[color:var(--hero-crit)]')}>
        <CountUp value={value} format={format} />
      </p>
      {sub && <p className="relative mt-3 text-[13px] leading-relaxed text-[color:var(--hero-muted)]">{sub}</p>}

      {progress && (
        <div className="relative mt-5">
          <div className="relative h-2.5 w-full rounded-full bg-[color:var(--hero-track)]">
            <span
              className={cn(
                'block h-full rounded-full transition-[width] duration-700 ease-out',
                progress.tone === 'neutral' ? 'bg-[color:var(--hero-neutral)]' : 'bg-[color:var(--hero-fill)]',
              )}
              style={{ width: `${Math.min(100, Math.max(0, progress.value) * 100)}%` }}
            />
            {progress.marker != null && (
              <span
                aria-hidden
                className="absolute top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-[color:var(--hero-marker)]"
                style={{ left: `${Math.min(100, progress.marker * 100)}%` }}
              />
            )}
          </div>
          {(progress.label || progress.right) && (
            <div className="mt-2.5 flex items-center justify-between gap-3 text-[12px] text-[color:var(--hero-muted)]">
              <span>{progress.label}</span>
              {progress.right}
            </div>
          )}
        </div>
      )}

      {children && <div className="relative mt-6 grid grid-cols-2 gap-3">{children}</div>}
    </div>
  );
}

/** Subcijfer in de zwarte kaart. */
export function MiniStat({
  label,
  value,
  sub,
  bar,
  barTone = 'brand',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  bar?: number | null;
  /** Groen alleen als meer beter is; anders neutraal wit. */
  barTone?: 'brand' | 'neutral';
}) {
  return (
    <div className="rounded-2xl bg-[color:var(--hero-surface)] px-4 py-3">
      <p className="text-[12px] text-[color:var(--hero-muted)]">{label}</p>
      <p className="mt-0.5 text-[20px] font-semibold tracking-tight tabular-nums">{value}</p>
      {bar != null && (
        <div className="mt-2 h-1.5 w-full rounded-full bg-[color:var(--hero-track)]">
          <span
            className={cn('block h-full rounded-full', barTone === 'brand' ? 'bg-[color:var(--hero-fill)]' : 'bg-[color:var(--hero-neutral)]')}
            style={{ width: `${Math.min(100, Math.max(0, bar) * 100)}%` }}
          />
        </div>
      )}
      {sub && <p className="mt-1.5 text-[11px] text-[color:var(--hero-faint)]">{sub}</p>}
    </div>
  );
}
