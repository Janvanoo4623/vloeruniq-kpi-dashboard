'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Info, Pencil } from 'lucide-react';
import type { PlanningOverview } from '@/lib/insights';
import type { PlanningData } from '@/lib/planning';
import PlanningTop from '@/components/pages/PlanningTop';
import { DetailsLabel } from '@/components/overview/cards';
import { formatEuro, formatNumber } from '@/lib/format';
import { AXIS_TICK, CHART } from '@/components/charts/theme';
import { ChartDefs } from '@/components/charts/Defs';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { ChartLegend } from '@/components/charts/ChartLegend';
import { Empty, Panel, cn } from '@/components/ui';

const monthLabel = (m: string) => {
  const [y, mm] = m.split('-');
  return `${['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][Number(mm) - 1]} ’${y.slice(2)}`;
};

/**
 * Wat staat er ingepland. Dit is het dunste dat we hebben — `deals` telt maar een
 * paar tientallen rijen en begint pas in februari 2026 — dus de waarschuwing staat
 * hier niet in de kleine lettertjes maar boven de grafiek. Een lege maand betekent
 * bijna zeker "nog niet ingepland", niet "geen werk", en dat verschil is te groot
 * om aan de lezer over te laten.
 */
/** Gemiddeld aantal weken in een maand. */
const WEKEN_PER_MAAND = 52 / 12;

export default function PlanningView({
  planning,
  plan,
  asOf,
  capacityPerWeek,
}: {
  planning: PlanningOverview;
  plan: PlanningData;
  asOf: string;
  /** m² die de ploegen samen per week kunnen leggen; null = niet ingesteld. */
  capacityPerWeek: number | null;
}) {
  const { months, sample } = planning;
  const nowMonth = asOf.substring(0, 7);
  const future = months.filter((m) => !m.past);
  const avgFuture =
    future.length > 0 ? future.reduce((s, m) => s + m.m2, 0) / future.length : null;
  const capMaand = capacityPerWeek ? capacityPerWeek * WEKEN_PER_MAAND : null;
  // Voorstel als er nog niets is ingesteld: de drukste maand tot nu toe, per week.
  const voorstel = Math.round(Math.max(0, ...months.filter((m) => m.past).map((m) => m.m2)) / WEKEN_PER_MAAND);

  return (
    <div className="space-y-5">
      <PlanningTop plan={plan} />

      <DetailsLabel />

      <Panel
        title="m² per uitvoeringsmaand"
        subtitle="Geplande klussen, gekoppeld aan de m² van de bijbehorende offerte"
        right={<CapacityControl value={capacityPerWeek} voorstel={voorstel} />}
      >
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-warn/25 bg-warn-soft px-3.5 py-2.5">
          <Info size={14} strokeWidth={2.2} className="mt-0.5 shrink-0 text-warn" />
          <p className="text-[12px] leading-relaxed text-warn">
            Lees een lage maand als <strong>nog niet ingepland</strong>, niet als geen werk. De
            planning steunt op {sample} deals die pas vanaf februari 2026 een uitvoerdatum hebben,
            dus er is geen seizoensvergelijking mogelijk en de verste maanden vullen zich nog aan.
          </p>
        </div>

        {months.length === 0 ? (
          <Empty>Nog geen klussen met een uitvoerdatum.</Empty>
        ) : (
          <>
            <ChartLegend
              items={[
                { label: 'Uitgevoerd', color: CHART.deals },
                { label: 'Ingepland', color: CHART.accepted },
                ...(avgFuture != null
                  ? [{ label: 'Gemiddelde ingeplande maand', color: CHART.axis, dashed: true }]
                  : []),
                ...(capMaand != null ? [{ label: 'Capaciteit', color: CHART.open, dashed: true }] : []),
              ]}
            />
            <ResponsiveContainer width="100%" height={264}>
              <BarChart data={months} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
                <ChartDefs />
                <CartesianGrid stroke={CHART.grid} strokeDasharray="2 5" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={monthLabel}
                  tick={AXIS_TICK}
                  axisLine={{ stroke: CHART.grid }}
                  tickLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  tickFormatter={(v) => `${Math.round(v)}`}
                />
                <Tooltip
                  cursor={{ fill: CHART.cursor, radius: 6 }}
                  content={
                    <ChartTooltip
                      labelFormat={monthLabel}
                      format={(v, key) =>
                        key === 'revenue' ? formatEuro(v) : key === 'jobs' ? `${v}` : `${formatNumber(v)} m²`
                      }
                      dotColors={{ m2: CHART.accepted }}
                    />
                  }
                />
                {avgFuture != null && (
                  <ReferenceLine
                    y={Math.round(avgFuture)}
                    stroke={CHART.axis}
                    strokeDasharray="5 4"
                    strokeWidth={1.4}
                  />
                )}
                {capMaand != null && (
                  <ReferenceLine y={Math.round(capMaand)} stroke={CHART.open} strokeDasharray="6 4" strokeWidth={1.6} />
                )}
                <ReferenceLine
                  x={nowMonth}
                  stroke={CHART.refused}
                  strokeDasharray="3 3"
                  strokeWidth={1.4}
                  label={{ value: 'nu', position: 'top', fill: CHART.refused, fontSize: 10.5 }}
                />
                <Bar dataKey="m2" name="m²" radius={[4, 4, 2, 2]} maxBarSize={40}>
                  {months.map((m, i) => (
                    <Cell key={i} fill={m.past ? CHART.deals : `url(#gAccepted)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </Panel>

      {future.length > 0 && (
        <Panel title="Wat er staat te gebeuren" subtitle="Per maand, vanaf nu" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[13px]">
              <thead>
                <tr className="border-b border-hair text-[11px] uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-2.5 text-left font-semibold">Maand</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Klussen</th>
                  <th className="px-5 py-2.5 text-right font-semibold">m²</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Omzet</th>
                  {capMaand != null && <th className="px-5 py-2.5 text-left font-semibold">Bezetting</th>}
                </tr>
              </thead>
              <tbody>
                {future.map((m) => (
                  <tr key={m.month} className="border-b border-hair last:border-0 hover:bg-sunk/60">
                    <td className="px-5 py-2.5 font-medium text-ink">{monthLabel(m.month)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">{m.jobs}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">
                      {formatNumber(m.m2)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums text-ink">
                      {formatEuro(m.revenue)}
                    </td>
                    {capMaand != null && <Bezetting m2={m.m2} cap={capMaand} />}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

/**
 * Hoe vol zit de maand? Boven de 90% kleurt het: dan is er geen ruimte meer
 * voor extra werk en heeft meer marketing weinig zin. Daaronder neutraal.
 */
function Bezetting({ m2, cap }: { m2: number; cap: number }) {
  const pct = cap > 0 ? (m2 / cap) * 100 : 0;
  return (
    <td className="px-5 py-2.5">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-sunk">
          <span className={cn('block h-full rounded-full', pct >= 90 ? 'bg-warn' : 'bg-accent')} style={{ width: `${Math.min(100, pct)}%` }} />
        </span>
        <span className={cn('tabular-nums', pct >= 90 ? 'font-semibold text-warn' : 'text-ink-soft')}>{Math.round(pct)}%</span>
      </div>
    </td>
  );
}

/** Capaciteit in m² per week, in te stellen waar je hem ziet. */
function CapacityControl({ value, voorstel }: { value: number | null; voorstel: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [w, setW] = useState(value?.toString() ?? (voorstel > 0 ? String(voorstel) : ''));
  const [bezig, setBezig] = useState(false);
  async function opslaan() {
    setBezig(true);
    try {
      const res = await fetch('/api/capacity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ m2PerWeek: w }) });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBezig(false);
    }
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-ink-mute hover:bg-sunk hover:text-ink"
      >
        <Pencil size={12} /> {value ? `Capaciteit ${formatNumber(value)} m²/week` : 'Capaciteit instellen'}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <input
        inputMode="numeric"
        value={w}
        onChange={(e) => setW(e.target.value.replace(/[^\d]/g, ''))}
        className="w-20 rounded-md border border-line bg-surface px-2 py-1 text-right text-[12.5px] tabular-nums outline-none focus:border-accent"
        aria-label="m² per week"
      />
      <span className="text-[12px] text-ink-mute">m²/week</span>
      <button type="button" disabled={bezig} onClick={opslaan} className="rounded-md bg-accent p-1 text-white disabled:opacity-50" aria-label="Opslaan">
        <Check size={13} />
      </button>
    </div>
  );
}
