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
import { Info } from 'lucide-react';
import type { PlanningOverview } from '@/lib/insights';
import { formatEuro, formatNumber } from '@/lib/format';
import { AXIS_TICK, CHART } from '@/components/charts/theme';
import { ChartDefs } from '@/components/charts/Defs';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { ChartLegend } from '@/components/charts/ChartLegend';
import { Empty, Panel, SectionLabel } from '@/components/ui';
import KpiCard from '@/components/KpiCard';

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
export default function PlanningView({
  planning,
  asOf,
}: {
  planning: PlanningOverview;
  asOf: string;
}) {
  const { months, backlogJobs, backlogM2, backlogRevenue, sample } = planning;
  const nowMonth = asOf.substring(0, 7);
  const future = months.filter((m) => !m.past);
  const avgFuture =
    future.length > 0 ? future.reduce((s, m) => s + m.m2, 0) / future.length : null;

  return (
    <div className="space-y-6">
      <section>
        <SectionLabel>Nog uit te voeren</SectionLabel>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Orderportefeuille"
            value={formatEuro(backlogRevenue)}
            sub={`${backlogJobs} klussen met een datum in de toekomst`}
          />
          <KpiCard
            label="Nog te leggen"
            value={`${formatNumber(backlogM2)} m²`}
            sub="over alle ingeplande klussen"
          />
          <KpiCard
            label="Eerstvolgende maand"
            value={future[0] ? `${formatNumber(future[0].m2)} m²` : '—'}
            sub={future[0] ? `${future[0].jobs} klussen in ${monthLabel(future[0].month)}` : undefined}
          />
          <KpiCard
            label="Gebaseerd op"
            value={String(sample)}
            sub="deals met een uitvoerdatum"
            signal={sample < 100 ? 'warn' : undefined}
          />
        </div>
      </section>

      <Panel
        title="m² per uitvoeringsmaand"
        subtitle="Geplande klussen, gekoppeld aan de m² van de bijbehorende offerte"
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
