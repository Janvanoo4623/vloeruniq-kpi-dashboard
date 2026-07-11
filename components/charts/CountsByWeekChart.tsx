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
import { shortWeek } from '@/lib/format';
import { AXIS_TICK, CHART } from './theme';
import { ChartTooltip } from './ChartTooltip';

export default function CountsByWeekChart({ data }: { data: WeeklyPoint[] }) {
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
        <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: CHART.cursor }}
          content={<ChartTooltip format={(v) => `${v}`} />}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART.text }} />
        <Bar stackId="c" dataKey="acceptedCount" name="Geaccepteerd" fill={CHART.accepted} radius={[0, 0, 0, 0]} />
        <Bar stackId="c" dataKey="openCount" name="Open" fill={CHART.open} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
