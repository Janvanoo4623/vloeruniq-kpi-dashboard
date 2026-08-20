'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { QuotedVsInvoiced } from '@/lib/customers';
import { formatDays, formatEuro } from '@/lib/format';
import { AXIS_TICK, CHART } from '@/components/charts/theme';
import { ChartDefs, grad } from '@/components/charts/Defs';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { ChartLegend } from '@/components/charts/ChartLegend';
import { Empty, Panel } from '@/components/ui';

const maandLabel = (m: string) => {
  const [j, mm] = m.split('-');
  return `${['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][Number(mm) - 1]} ’${j.slice(2)}`;
};
const compactEuro = (v: number) => (Math.abs(v) >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`);

/**
 * Zet je getekende offertes ook echt om in facturen, en hoe lang duurt dat?
 *
 * De twee lijnen lopen structureel uiteen en dat is geen fout: er wordt ook
 * gefactureerd zonder offerte. Ze staan naast elkaar om het rítme te vergelijken,
 * niet om te salderen — dat staat er daarom bij.
 */
export default function QuotedVsInvoicedPanel({ data }: { data: QuotedVsInvoiced }) {
  const { points, medianDaysToInvoice, p90DaysToInvoice, matched, acceptedTotal } = data;

  if (points.length < 2) {
    return (
      <Panel title="Geoffreerd vs. gefactureerd" subtitle="Per maand, ex. btw">
        <Empty>Te weinig historie.</Empty>
      </Panel>
    );
  }

  return (
    <Panel
      title="Geoffreerd vs. gefactureerd"
      subtitle={`Van akkoord tot eerste factuur duurt het mediaan ${formatDays(medianDaysToInvoice)}, in het traagste tiende ${formatDays(p90DaysToInvoice)}`}
    >
      <ChartLegend
        items={[
          { label: 'Geaccepteerde offertes', color: CHART.accepted },
          { label: 'Gefactureerd', color: CHART.open, dashed: true },
        ]}
        right={
          <span className="text-[11px] text-ink-faint">
            doorlooptijd o.b.v. {matched} van {acceptedTotal} offertes
          </span>
        }
      />
      <ResponsiveContainer width="100%" height={262}>
        <ComposedChart data={points} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
          <ChartDefs />
          <CartesianGrid stroke={CHART.grid} strokeDasharray="2 5" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={maandLabel}
            tick={AXIS_TICK}
            axisLine={{ stroke: CHART.grid }}
            tickLine={false}
            tickMargin={8}
            minTickGap={16}
          />
          <YAxis
            tickFormatter={compactEuro}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
            content={
              <ChartTooltip
                labelFormat={maandLabel}
                format={(v) => formatEuro(v)}
                dotColors={{ accepted: CHART.accepted, invoiced: CHART.open }}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="accepted"
            name="Geaccepteerde offertes"
            stroke={CHART.accepted}
            strokeWidth={2.4}
            fill={grad('aAccepted')}
            dot={false}
            activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff' }}
          />
          <Line
            type="monotone"
            dataKey="invoiced"
            name="Gefactureerd"
            stroke={CHART.open}
            strokeWidth={2.2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-3 border-t border-hair pt-3 text-[11.5px] leading-relaxed text-ink-faint">
        De lijnen lopen structureel uiteen en dat is geen fout — er wordt ook gefactureerd zonder
        offerte. Vergelijk het ritme, niet het saldo. De doorlooptijd is gekoppeld op klantnaam
        (er is geen verwijzing van factuur naar offerte), dus lees hem als indicatie.
      </p>
    </Panel>
  );
}
