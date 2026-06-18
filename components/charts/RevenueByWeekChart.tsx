'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WeeklyPoint } from '@/lib/series';
import { formatEuro, shortWeek } from '@/lib/format';
import { AXIS_TICK, CHART } from './theme';
import { ChartTooltip } from './ChartTooltip';

const compactEuro = (v: number) =>
  v >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`;

export default function RevenueByWeekChart({ data }: { data: WeeklyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
        <XAxis
          dataKey="week"
          tickFormatter={shortWeek}
          tick={AXIS_TICK}
          axisLine={{ stroke: CHART.grid }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={compactEuro}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          cursor={{ fill: CHART.cursor }}
          content={
            <ChartTooltip
              format={(v) => formatEuro(v, true)}
              labelFormat={(l) => l}
            />
          }
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART.text }} />
        <Bar dataKey="acceptedRevenue" name="Geaccepteerd" fill={CHART.accepted} radius={[3, 3, 0, 0]} />
        <Bar dataKey="openRevenue" name="Open" fill={CHART.open} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
