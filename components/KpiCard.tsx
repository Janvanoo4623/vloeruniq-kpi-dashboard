import type { ReactNode } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from './ui';

/**
 * Eén KPI. De accentkleur zit in een verlopende bovenrand en in een heel zachte
 * wash linksboven — nooit in het getal zelf. Het getal moet inkt blijven, anders
 * gaat kleur betekenis suggereren die er niet is. De delta-pil is wél gekleurd:
 * dáár betekent groen en rood echt beter en slechter.
 */
export type KpiAccent = 'accent' | 'oak' | 'good' | 'warn' | 'crit' | 'neutral';

/** rgb-triplet per accent, voor de wash. */
const ACCENT_RGB: Record<KpiAccent, string> = {
  accent: '14,107,99',
  oak: '180,118,42',
  good: '47,122,78',
  warn: '168,118,27',
  crit: '169,59,44',
  neutral: '120,113,108',
};

const ACCENT_HEX: Record<KpiAccent, string> = {
  accent: '#0e6b63',
  oak: '#b4762a',
  good: '#2f7a4e',
  warn: '#a8761b',
  crit: '#a93b2c',
  neutral: '#a8a29e',
};

export default function KpiCard({
  label,
  value,
  sub,
  accent = 'neutral',
  deltaPct,
  deltaLabel = 'vs vorige',
  higherIsBetter = true,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: KpiAccent;
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

  const rgb = ACCENT_RGB[accent];
  const hex = ACCENT_HEX[accent];

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-line bg-surface p-4',
        'shadow-[0_1px_2px_rgba(28,25,23,0.04),0_8px_24px_-16px_rgba(28,25,23,0.30)]',
        'transition-all duration-200 hover:-translate-y-px',
        'hover:shadow-[0_1px_2px_rgba(28,25,23,0.05),0_14px_32px_-16px_rgba(28,25,23,0.38)]',
        className,
      )}
    >
      {/* Verlopende bovenrand: vol bij het accent, uitdovend naar rechts. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2.5px]"
        style={{ backgroundImage: `linear-gradient(90deg, ${hex} 0%, ${hex}66 45%, transparent 100%)` }}
      />
      {/* Zachte wash linksboven — geeft de kaart diepte zonder een kleurvlak te worden. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(120% 150% at 0% 0%, rgba(${rgb},0.07) 0%, rgba(${rgb},0.02) 42%, rgba(${rgb},0) 72%)`,
        }}
      />

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
