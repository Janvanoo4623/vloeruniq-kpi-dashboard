'use client';

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { OpenStockPoint } from '@/lib/open-stock';
import { formatDays, formatEuro, formatNumber, shortWeek } from '@/lib/format';
import { AXIS_TICK, CHART } from './theme';
import { ChartDefs, grad } from './Defs';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';

const compactEuro = (v: number) => (v >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`);

/**
 * De openstaande stapel aan het eind van elke week: hoeveel geld er open
 * stond (staven) en hoe oud die offertes gemiddeld waren (lijn). Groeit de
 * stapel én stijgt de leeftijd, dan blijft er werk liggen; slinkt hij en
 * daalt de leeftijd, dan wordt er beslist.
 */
export default function OpenStockChart({ data }: { data: OpenStockPoint[] }) {
  return (
    <div>
      <ChartLegend
        items={[
          { label: 'Open (€)', color: CHART.open },
          { label: 'Gem. leeftijd (dagen)', color: CHART.runTime, dashed: true },
        ]}
      />
      <ResponsiveContainer width="100%" height={286}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
          <ChartDefs />
          <CartesianGrid stroke={CHART.grid} strokeDasharray="2 5" vertical={false} />
          <XAxis dataKey="week" tickFormatter={shortWeek} tick={AXIS_TICK} axisLine={{ stroke: CHART.grid }} tickLine={false} tickMargin={8} minTickGap={18} />
          <YAxis yAxisId="eur" tickFormatter={compactEuro} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
          <YAxis yAxisId="days" orientation="right" tickFormatter={(v) => `${v}d`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            cursor={{ fill: CHART.cursor, radius: 6 }}
            content={
              <ChartTooltip
                labelFormat={(l) => {
                  const p = data.find((d) => d.week === l);
                  return p ? `${l} · ${formatNumber(p.count)} open, ${formatNumber(p.olderThan60)} ouder dan 60 d` : l;
                }}
                format={(v, key) => (key === 'avgAgeDays' ? formatDays(v) : formatEuro(v))}
                dotColors={{ value: CHART.open, avgAgeDays: CHART.runTime }}
              />
            }
          />
          <Bar yAxisId="eur" dataKey="value" name="Open (€)" fill={grad('gOpen')} radius={[4, 4, 2, 2]} maxBarSize={30} />
          <Line yAxisId="days" type="monotone" dataKey="avgAgeDays" name="Gem. leeftijd" stroke={CHART.runTime} strokeWidth={2.2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
