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
import { shortWeek } from '@/lib/format';
import { AXIS_TICK, CHART } from './theme';
import { ChartDefs, grad } from './Defs';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';

export default function CountsByWeekChart({ data }: { data: WeeklyPoint[] }) {
  // Verlopen staat onderaan de stapel: het is de bodem waar offertes in wegzakken,
  // en zo lees je in één blik hoeveel van een week daadwerkelijk is blijven staan.
  const hasExpired = data.some((d) => (d.expiredCount ?? 0) > 0);

  return (
    <div>
      <ChartLegend
        items={[
          { label: 'Geaccepteerd', color: CHART.accepted },
          { label: 'Open', color: CHART.open },
          ...(hasExpired ? [{ label: 'Verlopen', color: CHART.expired }] : []),
        ]}
      />
      <ResponsiveContainer width="100%" height={286}>
        <BarChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
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
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: CHART.cursor, radius: 6 }}
            content={
              <ChartTooltip
                format={(v) => `${v}`}
                dotColors={{
                  acceptedCount: CHART.accepted,
                  openCount: CHART.open,
                  expiredCount: CHART.expired,
                }}
              />
            }
          />
          {hasExpired && (
            <Bar stackId="c" dataKey="expiredCount" name="Verlopen" fill={grad('gExpired')} maxBarSize={26} />
          )}
          <Bar stackId="c" dataKey="acceptedCount" name="Geaccepteerd" fill={grad('gAccepted')} maxBarSize={26} />
          <Bar
            stackId="c"
            dataKey="openCount"
            name="Open"
            fill={grad('gOpen')}
            radius={[4, 4, 0, 0]}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
