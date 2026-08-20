import type { ReactNode } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from './ui';

/**
 * Eén KPI.
 *
 * Kleur betekent hier iets of hij is er niet. Eerder kreeg elke kaart een eigen
 * accent — omzet petrol, marge groen, m² eiken — maar daar zat geen regel achter
 * die een lezer kan leren, dus las het als een willekeurige regenboog. Decoratie
 * die zich voordoet als betekenis is de vervelendste soort: je gaat een patroon
 * zoeken dat er niet is.
 *
 * Nu: standaard geen accent. Alleen als de waarde iets zegt dat aandacht vraagt
 * geef je `signal` mee, en dan is de kaart ook echt opvallend. De delta-pil
 * draagt los daarvan groen en rood, want dáár betekent het onmiskenbaar beter of
 * slechter.
 */
export type KpiSignal = 'good' | 'warn' | 'crit';

const SIGNAL: Record<KpiSignal, { bar: string; wash: string }> = {
  good: { bar: '#2f7a4e', wash: '47,122,78' },
  warn: { bar: '#a8761b', wash: '168,118,27' },
  crit: { bar: '#a93b2c', wash: '169,59,44' },
};

export default function KpiCard({
  label,
  value,
  sub,
  signal,
  deltaPct,
  deltaLabel = 'vs vorige',
  higherIsBetter = true,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  /** Alleen meegeven als de waarde zelf om aandacht vraagt. */
  signal?: KpiSignal;
  deltaPct?: number | null;
  deltaLabel?: string;
  higherIsBetter?: boolean;
  className?: string;
}) {
  const showDelta = deltaPct != null && Number.isFinite(deltaPct);
  const flat = Math.abs(deltaPct ?? 0) < 0.05;
  const up = (deltaPct ?? 0) >= 0;
  const good = higherIsBetter ? up : !up;
  const TrendIcon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const pill = flat
    ? 'bg-sunk text-ink-mute ring-ink-faint/20'
    : good
      ? 'bg-good-soft text-good ring-good/20'
      : 'bg-crit-soft text-crit ring-crit/20';

  const s = signal ? SIGNAL[signal] : null;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-surface p-4',
        s ? 'border-transparent' : 'border-line',
        'shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_-16px_rgba(28,25,23,0.30)]',
        'transition-all duration-200 hover:-translate-y-px',
        'hover:shadow-[0_1px_2px_rgba(28,25,23,0.05),0_14px_32px_-16px_rgba(28,25,23,0.38)]',
        className,
      )}
      style={s ? { boxShadow: `inset 0 0 0 1px rgba(${s.wash},0.28)` } : undefined}
    >
      {s && (
        <>
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-[2.5px]"
            style={{
              backgroundImage: `linear-gradient(90deg, ${s.bar} 0%, ${s.bar}66 45%, transparent 100%)`,
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(120% 150% at 0% 0%, rgba(${s.wash},0.08) 0%, rgba(${s.wash},0.02) 44%, rgba(${s.wash},0) 74%)`,
            }}
          />
        </>
      )}

      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11.5px] font-semibold leading-tight text-ink-soft">{label}</p>
          {showDelta && (
            <span
              title={deltaLabel}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums ring-1 ring-inset',
                pill,
              )}
            >
              <TrendIcon size={10} strokeWidth={2.6} />
              {Math.abs(deltaPct as number).toFixed(1).replace('.', ',')}%
            </span>
          )}
        </div>

        <p className="mt-2.5 text-[26px] font-bold leading-none tracking-tight text-ink tabular-nums">
          {value}
        </p>
        {sub && <p className="mt-1.5 text-[11.5px] leading-tight text-ink-faint">{sub}</p>}
      </div>
    </div>
  );
}
