'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WeeklyPoint } from '@/lib/series';
import { formatDays, shortWeek } from '@/lib/format';
import { AXIS_TICK, CHART } from './theme';
import { ChartTooltip } from './ChartTooltip';

export default function RunTimeTrendChart({ data }: { data: WeeklyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="runtimeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.runTime} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART.runTime} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
        <XAxis
          dataKey="week"
          tickFormatter={shortWeek}
          tick={AXIS_TICK}
          axisLine={{ stroke: CHART.grid }}
          tickLine={false}
        />
        <YAxis
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={36}
          tickFormatter={(v) => `${v}`}
        />
        <Tooltip
          cursor={{ stroke: CHART.grid }}
          content={<ChartTooltip format={(v) => formatDays(v)} />}
        />
        <Area
          type="monotone"
          dataKey="avgRunTime"
          name="Gem. doorlooptijd"
          stroke={CHART.runTime}
          strokeWidth={2}
          fill="url(#runtimeFill)"
          connectNulls
          dot={{ r: 2, fill: CHART.runTime }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
