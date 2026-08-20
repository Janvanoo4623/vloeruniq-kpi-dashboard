'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WinRateBucket, WinRatePoint } from '@/lib/insights';
import { formatEuro, formatPercent } from '@/lib/format';
import { AXIS_TICK, CHART } from './theme';
import { ChartDefs, grad } from './Defs';
import { ChartTooltip } from './ChartTooltip';
import { ChartLegend } from './ChartLegend';
import { Empty } from '@/components/ui';

const monthLabel = (m: string) => {
  const [y, mm] = m.split('-');
  return `${['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][Number(mm) - 1]} ’${y.slice(2)}`;
};

/**
 * Winkans per ordergrootte. De balk is de winkans, het label erachter het aantal
 * waarop hij steunt — zonder dat aantal is een percentage een mening.
 */
export function WinRateBySizeChart({ data }: { data: WinRateBucket[] }) {
  const usable = data.filter((d) => d.winRate != null);
  if (usable.length === 0) return <Empty>Te weinig uitgewerkte offertes voor een winkans.</Empty>;

  const overall =
    data.reduce((s, d) => s + d.won, 0) / Math.max(1, data.reduce((s, d) => s + d.won + d.lost, 0));

  return (
    <ul className="space-y-3">
      {data.map((d) => {
        const n = d.won + d.lost;
        const pct = d.winRate;
        // Onder het algemene gemiddelde is het signaal; daarboven gaat het goed.
        const below = pct != null && pct < overall * 100;
        return (
          <li key={d.label}>
            <div className="mb-1.5 flex items-baseline gap-2.5 text-[13px]">
              <span className="w-[76px] shrink-0 font-medium text-ink-soft">{d.label}</span>
              <span className="w-[52px] shrink-0 text-right font-bold tabular-nums text-ink">
                {pct == null ? '—' : `${String(pct).replace('.', ',')}%`}
              </span>
              <span className="shrink-0 text-[11.5px] tabular-nums text-ink-faint">
                {d.won} van {n}
              </span>
              <span className="ml-auto shrink-0 text-[11.5px] tabular-nums text-ink-faint">
                {formatEuro(d.value)} gewonnen
              </span>
            </div>
            <div className="ml-[86px] h-2.5 overflow-hidden rounded-full bg-sunk">
              <span
                className="block h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${pct ?? 0}%`,
                  backgroundImage: below
                    ? 'linear-gradient(90deg, var(--color-warn) 0%, color-mix(in oklab, var(--color-warn) 60%, white) 100%)'
                    : 'linear-gradient(90deg, var(--color-accent) 0%, color-mix(in oklab, var(--color-accent) 60%, white) 100%)',
                }}
              />
            </div>
          </li>
        );
      })}
      <li className="pt-1 text-[11.5px] text-ink-faint">
        Gemiddeld over alles: {formatPercent(Math.round(overall * 1000) / 10)}. Balken daaronder
        staan in amber.
      </li>
    </ul>
  );
}

/**
 * Winkans per maand. De laatste maanden zijn nog niet uitgehard — daar staan
 * offertes die simpelweg nog geen kans hebben gehad om te verlopen — dus die
 * krijgen een open staaf in plaats van een volle.
 */
export function WinRateTrendChart({ data }: { data: WinRatePoint[] }) {
  if (data.length < 3) return <Empty>Te weinig historie voor een verloop.</Empty>;

  const solid = data.filter((d) => !d.provisional && d.winRate != null);
  const avg =
    solid.length > 0 ? solid.reduce((s, d) => s + (d.winRate ?? 0), 0) / solid.length : null;
  const hasProvisional = data.some((d) => d.provisional);

  return (
    <div>
      <ChartLegend
        items={[
          { label: 'Uitgewerkte offertes', color: CHART.deals },
          { label: 'Winkans', color: CHART.accepted },
          ...(avg != null ? [{ label: 'Gemiddelde winkans', color: CHART.axis, dashed: true }] : []),
        ]}
        right={
          hasProvisional ? (
            <span className="text-[11px] text-ink-faint">
              Laatste maanden nog niet uitgehard — lichter getoond
            </span>
          ) : null
        }
      />
      <ResponsiveContainer width="100%" height={272}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
          <ChartDefs />
          <CartesianGrid stroke={CHART.grid} strokeDasharray="2 5" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={monthLabel}
            tick={AXIS_TICK}
            axisLine={{ stroke: CHART.grid }}
            tickLine={false}
            tickMargin={8}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="n"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={28}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="pct"
            orientation="right"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: CHART.cursor, radius: 6 }}
            content={
              <ChartTooltip
                labelFormat={monthLabel}
                format={(v, key) => (key === 'winRate' ? formatPercent(v) : `${v} offertes`)}
                dotColors={{ decided: CHART.deals, winRate: CHART.accepted }}
              />
            }
          />
          {avg != null && (
            <ReferenceLine
              yAxisId="pct"
              y={Math.round(avg * 10) / 10}
              stroke={CHART.axis}
              strokeDasharray="5 4"
              strokeWidth={1.4}
            />
          )}
          <Bar yAxisId="n" dataKey="decided" name="Uitgewerkte offertes" maxBarSize={22} radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={CHART.deals} opacity={d.provisional ? 0.45 : 1} />
            ))}
          </Bar>
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="winRate"
            name="Winkans"
            stroke={CHART.accepted}
            strokeWidth={2.4}
            dot={false}
            activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff' }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Hoe lang doet een klant erover om ja te zeggen? */
export function DecisionTimeChart({
  buckets,
}: {
  buckets: { label: string; count: number; share: number }[];
}) {
  if (buckets.every((b) => b.count === 0)) return <Empty>Geen geaccepteerde offertes.</Empty>;

  return (
    <ResponsiveContainer width="100%" height={232}>
      <BarChart data={buckets} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
        <ChartDefs />
        <CartesianGrid stroke={CHART.grid} strokeDasharray="2 5" vertical={false} />
        <XAxis
          dataKey="label"
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
              format={(v, key) => (key === 'share' ? formatPercent(v) : `${v} offertes`)}
              dotColors={{ count: CHART.accepted }}
            />
          }
        />
        <Bar
          dataKey="count"
          name="Offertes"
          fill={grad('gAccepted')}
          radius={[4, 4, 2, 2]}
          maxBarSize={64}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
