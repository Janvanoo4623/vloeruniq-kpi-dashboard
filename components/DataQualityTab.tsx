'use client';

import { ArrowRight, Check, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import type { QualityMetric, QualityReport } from '@/lib/data-quality';
import { formatNumber } from '@/lib/format';
import { cn } from '@/components/ui';

const STATUS_STYLE = {
  good: { bar: 'bg-good', tekst: 'text-good', vlak: 'bg-good-soft' },
  warn: { bar: 'bg-warn', tekst: 'text-warn', vlak: 'bg-warn-soft' },
  crit: { bar: 'bg-crit', tekst: 'text-crit', vlak: 'bg-crit-soft' },
} as const;

/**
 * Datakwaliteit als cijfer. Hoort in beheer en niet bij de dagelijkse cijfers:
 * je kijkt hier af en toe naar om te zien of de bron beter wordt, niet elke dag.
 *
 * Elke meter zegt drie dingen: wat het getal is, wat het kóst dat het zo is, en
 * wat je eraan doet. Een meter zonder handeling erbij is een verwijt.
 */
export default function DataQualityTab({ report }: { report: QualityReport }) {
  const { metrics, overall, history } = report;
  const vorige = history.length > 1 ? history[history.length - 2].overall : null;
  const delta = vorige != null ? overall - vorige : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-5 rounded-xl border border-line bg-canvas/60 px-4 py-3.5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
            Totaalcijfer
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-[30px] font-bold leading-none tabular-nums text-ink">{overall}</span>
            <span className="text-[13px] text-ink-faint">/ 100</span>
            {delta != null && delta !== 0 && (
              <span
                className={cn(
                  'flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                  delta > 0 ? 'bg-good-soft text-good' : 'bg-crit-soft text-crit',
                )}
              >
                {delta > 0 ? <TrendingUp size={10} strokeWidth={2.6} /> : <TrendingDown size={10} strokeWidth={2.6} />}
                {Math.abs(delta)}
              </span>
            )}
          </p>
        </div>
        <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink-mute">
          Hoe betrouwbaar de cijfers in dit dashboard zijn, gemeten bij elke synchronisatie.
          {history.length > 1 ? (
            <> Er zijn {history.length} metingen bewaard, dus je ziet of het de goede kant op gaat.</>
          ) : (
            <> Dit is de eerste meting; vanaf de volgende sync ontstaat er een reeks.</>
          )}
        </p>
        {history.length > 3 && <Sparkline waarden={history.map((h) => h.overall)} />}
      </div>

      <ul className="space-y-2">
        {metrics.map((m) => (
          <MetricRij key={m.key} m={m} />
        ))}
      </ul>
    </div>
  );
}

function MetricRij({ m }: { m: QualityMetric }) {
  const s = STATUS_STYLE[m.status];
  // Percentages vullen de balk direct; aantallen en dagen hebben geen natuurlijk
  // maximum, dus daar toont de balk niets en spreekt het getal voor zich.
  const vulling = m.unit === '%' ? Math.max(0, Math.min(100, m.value)) : null;

  const waarde =
    m.unit === '%'
      ? `${formatNumber(m.value)}%`
      : m.unit === 'dagen'
        ? m.value < 0
          ? 'nooit'
          : `${formatNumber(m.value)} d`
        : formatNumber(m.value);

  return (
    <li className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[13px] font-semibold text-ink">{m.label}</span>
        <span className={cn('text-[16px] font-bold tabular-nums', s.tekst)}>{waarde}</span>
        {m.status === 'good' && (
          <span className="flex items-center gap-1 text-[11.5px] font-medium text-good">
            <Check size={11} strokeWidth={3} /> in orde
          </span>
        )}
        {m.href && m.status !== 'good' && (
          <Link
            href={m.href}
            className="ml-auto flex items-center gap-1 text-[11.5px] font-medium text-accent hover:underline"
          >
            Oplossen <ArrowRight size={11} strokeWidth={2.2} />
          </Link>
        )}
      </div>

      {vulling != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunk">
          <span className={cn('block h-full rounded-full', s.bar)} style={{ width: `${vulling}%` }} />
        </div>
      )}

      <p className="mt-2 text-[12px] leading-relaxed text-ink-mute">{m.meaning}</p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-ink-faint">{m.action}</p>
    </li>
  );
}

/** Kleine trendlijn. Geen assen, geen labels — alleen de richting. */
function Sparkline({ waarden }: { waarden: number[] }) {
  const min = Math.min(...waarden);
  const max = Math.max(...waarden);
  const bereik = Math.max(1, max - min);
  const punten = waarden
    .map((v, i) => {
      const x = (i / Math.max(1, waarden.length - 1)) * 100;
      const y = 28 - ((v - min) / bereik) * 24;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width="120" height="32" viewBox="0 0 100 32" className="shrink-0" role="img" aria-label="Verloop">
      <polyline
        points={punten}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
