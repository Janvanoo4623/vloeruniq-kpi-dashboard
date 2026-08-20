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
import type { WeeklyPoint } from '@/lib/series';
import { formatEuro, shortWeek } from '@/lib/format';
import { AXIS_TICK, CHART } from './theme';
import { ChartDefs, grad } from './Defs';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';

const compactEuro = (v: number) => (v >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`);

export default function RevenueByWeekChart({ data }: { data: WeeklyPoint[] }) {
  return (
    <div>
      <ChartLegend
        items={[
          { label: 'Geaccepteerd', color: CHART.accepted },
          { label: 'Open', color: CHART.open },
        ]}
      />
      <ResponsiveContainer width="100%" height={286}>
        <BarChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 0 }} barGap={3}>
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
            tickFormatter={compactEuro}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            cursor={{ fill: CHART.cursor, radius: 6 }}
            content={<ChartTooltip format={(v) => formatEuro(v, true)} labelFormat={(l) => l} />}
          />
          <Bar
            dataKey="acceptedRevenue"
            name="Geaccepteerd"
            fill={grad('gAccepted')}
            radius={[4, 4, 2, 2]}
            maxBarSize={26}
          />
          <Bar
            dataKey="openRevenue"
            name="Open"
            fill={grad('gOpen')}
            radius={[4, 4, 2, 2]}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
