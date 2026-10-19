'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import CountUp from '@/components/CountUp';
import { cn } from '@/components/ui';

export type HeroTone = 'good' | 'warn' | 'crit' | 'neutral';

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
  progress?: { value: number; marker?: number; label?: ReactNode; right?: ReactNode };
  /** Subcijfers onderin (MiniStat). */
  children?: ReactNode;
  href?: string;
  hrefLabel?: string;
  /** Het getal zelf rood kleuren (bv. een verlies of een tekort). */
  valueTone?: 'crit';
}) {
  return (
    <div className="relative h-full overflow-hidden rounded-[28px] bg-night p-7 text-white shadow-[0_24px_60px_-30px_rgba(19,19,19,0.7)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rotate-12 opacity-[0.07]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, #fff 0 2px, transparent 2px 22px), repeating-linear-gradient(-45deg, #fff 0 2px, transparent 2px 22px)',
          maskImage: 'radial-gradient(circle at 70% 30%, #000 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle at 70% 30%, #000 0%, transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className={cn('pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full blur-3xl', valueTone === 'crit' ? 'bg-crit/30' : 'bg-brand/25')}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-white/60">{label}</span>
          {status && (
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold',
                tone === 'good' && 'bg-brand/15 text-brand',
                tone === 'warn' && 'bg-warn/25 text-[#f3c66b]',
                tone === 'crit' && 'bg-crit/30 text-[#f2a294]',
                (!tone || tone === 'neutral') && 'bg-white/10 text-white/75',
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <ArrowUpRight size={17} />
          </Link>
        )}
      </div>

      <p className={cn('relative mt-6 text-[46px] font-semibold leading-none tracking-[-0.035em] tabular-nums', valueTone === 'crit' && 'text-[#f2a294]')}>
        <CountUp value={value} format={format} />
      </p>
      {sub && <p className="relative mt-3 text-[13px] leading-relaxed text-white/60">{sub}</p>}

      {progress && (
        <div className="relative mt-5">
          <div className="relative h-2.5 w-full rounded-full bg-white/10">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-brand/70 to-brand transition-[width] duration-700 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress.value) * 100)}%` }}
            />
            {progress.marker != null && (
              <span
                aria-hidden
                className="absolute top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-white/70"
                style={{ left: `${Math.min(100, progress.marker * 100)}%` }}
              />
            )}
          </div>
          {(progress.label || progress.right) && (
            <div className="mt-2.5 flex items-center justify-between gap-3 text-[12px] text-white/55">
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
    <div className="rounded-2xl bg-white/[0.06] px-4 py-3">
      <p className="text-[12px] text-white/55">{label}</p>
      <p className="mt-0.5 text-[20px] font-semibold tracking-tight tabular-nums">{value}</p>
      {bar != null && (
        <div className="mt-2 h-1.5 w-full rounded-full bg-white/10">
          <span
            className={cn('block h-full rounded-full', barTone === 'brand' ? 'bg-brand/80' : 'bg-white/45')}
            style={{ width: `${Math.min(100, Math.max(0, bar) * 100)}%` }}
          />
        </div>
      )}
      {sub && <p className="mt-1.5 text-[11px] text-white/45">{sub}</p>}
    </div>
  );
}
