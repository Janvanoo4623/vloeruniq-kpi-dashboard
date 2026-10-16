'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, X } from 'lucide-react';
import type { Goals, MonthProgress } from '@/lib/today';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { Card, cn } from '@/components/ui';
import CountUp from '@/components/CountUp';

const MAAND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/**
 * De lopende maand tegenover het doel. Het streepje in de balk is waar je
 * zou moeten staan als het werk gelijkmatig over de maand binnenkomt; voor of
 * achter dat streepje is het hele verhaal. Zonder doel tonen we de vorige
 * maand als maatstaf, en een knop om er een te zetten.
 */
export default function MonthGoal({ month }: { month: MonthProgress }) {
  const [bewerken, setBewerken] = useState(false);
  const naam = MAAND[Number(month.month.slice(5, 7)) - 1];
  const verstreken = month.day / month.daysInMonth;

  const rijen: { key: keyof Goals; label: string; value: number; fmt: (v: number) => string; prev: number }[] = [
    { key: 'revenue', label: 'Omzet geaccepteerd', value: month.revenue, fmt: (v) => formatEuro(v), prev: month.prevTotal.revenue },
    { key: 'margin', label: 'Marge', value: month.margin, fmt: (v) => formatEuro(v), prev: month.prevTotal.margin },
    { key: 'm2', label: 'M² verkocht', value: month.m2, fmt: (v) => `${formatNumber(v)} m²`, prev: month.prevTotal.m2 },
  ];
  const hoofd = rijen[0];
  const doel = month.goals.revenue;
  const maat = doel ?? (hoofd.prev || null);
  const aandeel = maat ? hoofd.value / maat : null;
  const status = aandeel == null ? null : aandeel >= verstreken + 0.05 ? 'voor' : aandeel <= verstreken - 0.1 ? 'achter' : 'op schema';

  return (
    <Card className="h-full">
      <div className="px-6 py-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
            {naam} · dag {month.day} van {month.daysInMonth}
          </p>
          <button
            type="button"
            onClick={() => setBewerken((b) => !b)}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-ink-mute hover:bg-sunk hover:text-ink"
          >
            {bewerken ? <X size={12} /> : <Pencil size={12} />} {doel ? 'Doelen' : 'Doel instellen'}
          </button>
        </div>

        {bewerken ? (
          <GoalForm goals={month.goals} onDone={() => setBewerken(false)} />
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
              <p className="text-[48px] font-bold leading-none tracking-tight tabular-nums text-ink"><CountUp value={hoofd.value} format={(v) => formatEuro(v)} /></p>
              {status && (
                <span
                  className={cn(
                    'mb-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                    status === 'voor' && 'bg-good-soft text-good ring-good/20',
                    status === 'achter' && 'bg-warn-soft text-warn ring-warn/20',
                    status === 'op schema' && 'bg-sunk text-ink-mute ring-ink-faint/15',
                  )}
                >
                  {status === 'voor' ? 'loopt voor' : status === 'achter' ? 'loopt achter' : 'op schema'}
                </span>
              )}
            </div>
            <p className="mt-2 text-[13px] text-ink-mute">
              {doel
                ? `${formatPercent(Math.round((aandeel ?? 0) * 100))} van het maanddoel van ${formatEuro(doel)}`
                : maat
                  ? `${formatPercent(Math.round((aandeel ?? 0) * 100))} van heel vorige maand (${formatEuro(maat)}) — stel een doel in voor een echte maatstaf`
                  : 'gewonnen offertes deze maand'}
            </p>

            <Meter value={aandeel} expected={verstreken} />

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-hair pt-4">
              {rijen.slice(1).map((r) => {
                const g = month.goals[r.key];
                const a = g ? r.value / g : r.prev ? r.value / r.prev : null;
                return (
                  <div key={r.key}>
                    <p className="text-[12px] text-ink-mute">{r.label}</p>
                    <p className="mt-0.5 text-[18px] font-semibold tabular-nums text-ink">{r.fmt(r.value)}</p>
                    <Meter value={a} expected={verstreken} thin />
                    <p className="mt-1 text-[11px] text-ink-faint">{g ? `doel ${r.fmt(g)}` : `vorige maand ${r.fmt(r.prev)}`}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function Meter({ value, expected, thin }: { value: number | null; expected: number; thin?: boolean }) {
  if (value == null) return null;
  return (
    <div className={cn('relative mt-4 w-full rounded-full bg-sunk', thin ? 'mt-2 h-1.5' : 'h-3')}>
      <span
        className="block h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
        style={{ width: `${Math.min(100, value * 100)}%` }}
      />
      {/* Waar je nu zou staan bij een gelijkmatig tempo. */}
      <span
        aria-hidden
        className={cn('absolute top-1/2 w-[2px] -translate-y-1/2 rounded-full bg-ink/60', thin ? 'h-3' : 'h-5')}
        style={{ left: `${expected * 100}%` }}
        title="Hier zou je staan bij een gelijkmatig tempo"
      />
    </div>
  );
}

function GoalForm({ goals, onDone }: { goals: Goals; onDone: () => void }) {
  const router = useRouter();
  const [w, setW] = useState({
    revenue: goals.revenue?.toString() ?? '',
    margin: goals.margin?.toString() ?? '',
    m2: goals.m2?.toString() ?? '',
  });
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function opslaan() {
    setBezig(true);
    setFout(null);
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(w),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) setFout(json.error || 'Opslaan mislukt.');
      else {
        onDone();
        router.refresh();
      }
    } catch {
      setFout('Opslaan mislukt (netwerk).');
    } finally {
      setBezig(false);
    }
  }

  const veld = (key: keyof typeof w, label: string, eenheid: string) => (
    <label className="block">
      <span className="text-[12px] text-ink-mute">{label}</span>
      <span className="mt-1 flex items-center rounded-lg border border-line bg-surface px-2.5 focus-within:border-accent">
        <span className="text-[13px] text-ink-faint">{eenheid}</span>
        <input
          inputMode="numeric"
          value={w[key]}
          onChange={(e) => setW({ ...w, [key]: e.target.value.replace(/[^\d]/g, '') })}
          placeholder="geen doel"
          className="w-full bg-transparent px-2 py-1.5 text-[14px] tabular-nums text-ink outline-none"
        />
      </span>
    </label>
  );

  return (
    <div className="mt-3 space-y-3">
      <p className="text-[12.5px] text-ink-mute">Maanddoelen gelden voor elke maand. Leeg laten is geen doel.</p>
      {veld('revenue', 'Omzet geaccepteerd per maand, ex btw', '€')}
      <div className="grid grid-cols-2 gap-3">
        {veld('margin', 'Marge per maand', '€')}
        {veld('m2', 'M² per maand', 'm²')}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={bezig}
          onClick={opslaan}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          <Check size={14} /> Opslaan
        </button>
        {fout && <span className="text-[12px] text-crit">{fout}</span>}
      </div>
    </div>
  );
}
