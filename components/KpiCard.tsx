import type { ReactNode } from 'react';

export default function KpiCard({
  label,
  value,
  sub,
  accent = 'neutral',
  deltaPct,
  deltaLabel = 'vs vorige',
  higherIsBetter = true,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  accent?: 'neutral' | 'emerald' | 'sky' | 'violet' | 'amber' | 'cyan' | 'rose';
  deltaPct?: number | null;
  deltaLabel?: string;
  higherIsBetter?: boolean;
}) {
  const accentBar: Record<string, string> = {
    neutral: 'bg-neutral-600',
    emerald: 'bg-emerald-500',
    sky: 'bg-sky-500',
    violet: 'bg-violet-400',
    amber: 'bg-amber-400',
    cyan: 'bg-cyan-400',
    rose: 'bg-rose-500',
  };

  const showDelta = deltaPct != null && Number.isFinite(deltaPct);
  const up = (deltaPct ?? 0) >= 0;
  const good = higherIsBetter ? up : !up;
  const deltaColor = Math.abs(deltaPct ?? 0) < 0.05 ? 'text-neutral-400' : good ? 'text-emerald-600' : 'text-rose-600';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <span className={`absolute inset-x-0 top-0 h-1 ${accentBar[accent]}`} />
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-900">{value}</p>
      {showDelta ? (
        <p className={`mt-1 text-xs font-medium ${deltaColor}`}>
          {up ? '▲' : '▼'} {Math.abs(deltaPct as number).toFixed(1).replace('.', ',')}%{' '}
          <span className="font-normal text-neutral-400">{deltaLabel}</span>
        </p>
      ) : (
        sub && <p className="mt-1 text-xs text-neutral-500">{sub}</p>
      )}
    </div>
  );
}
