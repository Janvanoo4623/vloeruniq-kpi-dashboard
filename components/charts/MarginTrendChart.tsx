'use client';

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WeeklyPoint } from '@/lib/series';
import { formatEuro, formatPercent, shortWeek } from '@/lib/format';
import { AXIS_TICK, CHART } from './theme';
import { ChartDefs, grad } from './Defs';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';

const compactEuro = (v: number) => (v >= 1000 ? `\u20ac${Math.round(v / 1000)}k` : `\u20ac${Math.round(v)}`);

export default function MarginTrendChart({ data }: { data: WeeklyPoint[] }) {
  return (
    <div>
      <ChartLegend
        items={[
          { label: 'Marge (\u20ac)', color: CHART.margin },
          { label: 'Marge (%)', color: CHART.marginPct, dashed: true },
        ]}
      />
      <ResponsiveContainer width="100%" height={286}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
          <ChartDefs />
          <CartesianGrid stroke={CHART.grid} strokeDasharray="2 5" vertical={false} />
          <XAxis
            dataKey="week"
            tickFormatter={shortWeek}
            tick={AXIS_TICK}
            axisLine={{ stroke: CHART.grid }}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            yAxisId="eur"
            tickFormatter={compactEuro}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            tickFormatter={(v) => `${v}%`}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: CHART.cursor, radius: 6 }}
            content={
              <ChartTooltip
                format={(v, key) => (key === 'marginPct' ? formatPercent(v) : formatEuro(v, true))}
                dotColors={{ margin: CHART.margin, marginPct: CHART.marginPct }}
              />
            }
          />
          <Bar
            yAxisId="eur"
            dataKey="margin"
            name="Marge (\u20ac)"
            fill={grad('gMargin')}
            radius={[4, 4, 2, 2]}
            maxBarSize={30}
          />
          {/* Zacht vlak onder de procentlijn: geeft de lijn gewicht zonder dat hij
              met de staven om aandacht gaat vechten. */}
          <Area
            yAxisId="pct"
            type="monotone"
            dataKey="marginPct"
            stroke="none"
            fill={grad('aMargin')}
            connectNulls
            legendType="none"
            tooltipType="none"
          />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="marginPct"
            name="Marge (%)"
            stroke={CHART.marginPct}
            strokeWidth={2.2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
