'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useState } from 'react';
import type { LeadSourceTrend } from '@/lib/insights';
import { formatEuro, formatPercent } from '@/lib/format';
import { AXIS_TICK, CHART, sourceColor } from './theme';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';
import { Empty, cn } from '@/components/ui';

const maandLabel = (m: string) => {
  const [j, mm] = m.split('-');
  return `${['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][Number(mm) - 1]} ’${j.slice(2)}`;
};
const compactEuro = (v: number) => (Math.abs(v) >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`);

/**
 * Leadbronnen over tijd. Twee weergaves, want er zijn twee vragen:
 *   absoluut  — groeit een bron in euro's?
 *   aandeel   — verschuift de mix, ook als het totaal beweegt?
 * Alleen het aandeel tonen verbergt krimp; alleen absoluut tonen verbergt een
 * verschuiving in een goed jaar. Vandaar allebei, met één knop ertussen.
 */
export default function LeadSourceTrendChart({ data }: { data: LeadSourceTrend }) {
  const [modus, setModus] = useState<'euro' | 'aandeel'>('euro');
  const { points, sources, totals } = data;

  if (points.length < 2 || sources.length === 0) {
    return <Empty>Te weinig historie voor een verloop per leadbron.</Empty>;
  }

  // Kleur volgt de naam (theme.ts), zodat Google hier dezelfde kleur heeft als in de donut.
  const kleurVan = (naam: string) => sourceColor(naam);

  return (
    <div>
      <ChartLegend
        items={sources.map((s) => ({ label: s, color: kleurVan(s) }))}
        right={
          <div className="flex rounded-full bg-sunk p-1 text-[11.5px]">
            {(
              [
                ['euro', 'In euro’s'],
                ['aandeel', 'Als aandeel'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setModus(k)}
                className={cn(
                  'rounded-full px-2 py-1 font-medium transition',
                  modus === k ? 'bg-night text-white shadow-sm' : 'text-ink-mute hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      <ResponsiveContainer width="100%" height={272}>
        <BarChart data={points} margin={{ top: 6, right: 8, left: 4, bottom: 0 }} stackOffset={modus === 'aandeel' ? 'expand' : undefined}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="2 5" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={maandLabel}
            tick={AXIS_TICK}
            axisLine={{ stroke: CHART.grid }}
            tickLine={false}
            tickMargin={8}
            minTickGap={16}
          />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={48}
            tickFormatter={(v) => (modus === 'aandeel' ? `${Math.round(v * 100)}%` : compactEuro(v))}
          />
          <Tooltip
            cursor={{ fill: CHART.cursor }}
            content={
              <ChartTooltip
                labelFormat={maandLabel}
                format={(v) => formatEuro(v)}
                dotColors={Object.fromEntries(sources.map((s) => [s, kleurVan(s)]))}
              />
            }
          />
          {/* Gestapelde staven per maand. Gestapelde vlakken met gladde curves
              lieten lagen door elkaar lijken te lopen en verzonnen golven
              tussen twee maanden; een staaf is gewoon wat er die maand was. */}
          {sources.map((s, i) => (
            <Bar
              key={s}
              dataKey={s}
              name={s}
              stackId="bron"
              fill={kleurVan(s)}
              fillOpacity={0.88}
              maxBarSize={28}
              radius={i === sources.length - 1 ? [3, 3, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-hair pt-3">
        {totals.map((t) => (
          <li key={t.name} className="flex items-baseline gap-1.5 text-[12px]">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 translate-y-px rounded-[3px]"
              style={{ background: kleurVan(t.name) }}
            />
            <span className="text-ink-soft">{t.name}</span>
            <span className="font-semibold tabular-nums text-ink">{formatEuro(t.revenue)}</span>
            <span className="tabular-nums text-ink-faint">{formatPercent(t.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
