'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WeeklyPoint } from '@/lib/series';
import { formatEuro, formatPercent, shortWeek } from '@/lib/format';
import { AXIS_TICK, CHART } from './theme';
import { ChartTooltip } from './ChartTooltip';

const compactEuro = (v: number) =>
  v >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`;

export default function MarginTrendChart({ data }: { data: WeeklyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
        <XAxis
          dataKey="week"
          tickFormatter={shortWeek}
          tick={AXIS_TICK}
          axisLine={{ stroke: CHART.grid }}
          tickLine={false}
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
          cursor={{ fill: CHART.cursor }}
          content={
            <ChartTooltip
              format={(v, key) => (key === 'marginPct' ? formatPercent(v) : formatEuro(v, true))}
            />
          }
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART.text }} />
        <Bar
          yAxisId="eur"
          dataKey="margin"
          name="Marge (€)"
          fill={CHART.margin}
          radius={[3, 3, 0, 0]}
        />
        <Line
          yAxisId="pct"
          type="monotone"
          dataKey="marginPct"
          name="Marge (%)"
          stroke={CHART.marginPct}
          strokeWidth={2}
          dot={{ r: 2 }}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
