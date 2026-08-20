'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WeeklyPoint } from '@/lib/series';
import { formatDays, shortWeek } from '@/lib/format';
import { AXIS_TICK, CHART } from './theme';
import { ChartDefs, grad } from './Defs';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';

export default function RunTimeTrendChart({ data }: { data: WeeklyPoint[] }) {
  // Het gemiddelde als stippellijn erbij: een losse week zegt weinig, de afwijking
  // ervan wel. Alleen tekenen als er genoeg weken met data zijn om iets te middelen.
  const values = data.map((d) => d.avgRunTime).filter((v): v is number => v != null && v > 0);
  const avg = values.length >= 3 ? values.reduce((s, v) => s + v, 0) / values.length : null;

  return (
    <div>
      <ChartLegend
        items={[
          { label: 'Gem. doorlooptijd', color: CHART.runTime },
          ...(avg != null ? [{ label: 'Gemiddelde over de periode', color: CHART.axis, dashed: true }] : []),
        ]}
      />
      <ResponsiveContainer width="100%" height={286}>
        <AreaChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
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
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip
            cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
            content={<ChartTooltip format={(v) => formatDays(v)} dotColors={{ avgRunTime: CHART.runTime }} />}
          />
          {avg != null && (
            <ReferenceLine
              y={Math.round(avg * 10) / 10}
              stroke={CHART.axis}
              strokeDasharray="5 4"
              strokeWidth={1.4}
            />
          )}
          <Area
            type="monotone"
            dataKey="avgRunTime"
            name="Gem. doorlooptijd"
            stroke={CHART.runTime}
            strokeWidth={2.4}
            fill={grad('aRunTime')}
            connectNulls
            dot={false}
            activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
