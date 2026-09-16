'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AdsWeekPoint } from '@/lib/ads';
import { formatEuro, formatNumber, shortWeek } from '@/lib/format';
import { AXIS_TICK, CHART } from './theme';
import { ChartDefs, grad } from './Defs';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';

const compactEuro = (v: number) => (v >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`);

/** Kosten (staven, linkeras) en conversies (lijn, rechteras) per week. */
export default function AdsWeekChart({ data }: { data: AdsWeekPoint[] }) {
  return (
    <div>
      <ChartLegend
        items={[
          { label: 'Kosten', color: CHART.adsCost },
          { label: 'Conversies', color: CHART.adsConversions, dashed: true },
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
            minTickGap={18}
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
            yAxisId="n"
            orientation="right"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={36}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: CHART.cursor, radius: 6 }}
            content={
              <ChartTooltip
                format={(v, key) => (key === 'conversions' ? formatNumber(Math.round(v * 10) / 10) : formatEuro(v, true))}
                dotColors={{ cost: CHART.adsCost, conversions: CHART.adsConversions }}
              />
            }
          />
          <Bar
            yAxisId="eur"
            dataKey="cost"
            name="Kosten"
            fill={grad('gAdsCost')}
            radius={[4, 4, 2, 2]}
            maxBarSize={30}
          />
          <Line
            yAxisId="n"
            type="monotone"
            dataKey="conversions"
            name="Conversies"
            stroke={CHART.adsConversions}
            strokeWidth={2.2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
