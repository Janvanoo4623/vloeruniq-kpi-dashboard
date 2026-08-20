import type { ReactNode } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from './ui';

/**
 * Eén KPI. De accentkleur zit in een dunne bovenrand en in het icoon, nooit in
 * het getal zelf — het getal moet altijd inkt zijn, anders gaat kleur betekenis
 * suggereren die er niet is. De delta-pil is wél gekleurd: dáár betekent groen
 * en rood echt beter en slechter.
 */
export type KpiAccent = 'accent' | 'oak' | 'good' | 'warn' | 'crit' | 'neutral';

const ACCENT_BAR: Record<KpiAccent, string> = {
  accent: 'bg-accent',
  oak: 'bg-oak',
  good: 'bg-good',
  warn: 'bg-warn',
  crit: 'bg-crit',
  neutral: 'bg-ink-faint',
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
    ? 'bg-sunk text-ink-mute'
    : good
      ? 'bg-good-soft text-good'
      : 'bg-crit-soft text-crit';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:shadow-md',
        className,
      )}
    >
      <span className={cn('absolute inset-x-0 top-0 h-[2px]', ACCENT_BAR[accent])} />

      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-semibold leading-tight text-ink-soft">{label}</p>
        {showDelta && (
          <span
            title={deltaLabel}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums',
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
  );
}
