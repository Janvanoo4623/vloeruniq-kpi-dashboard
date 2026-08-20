'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { buildTimeSeries, type Granularity } from '@/lib/series';
import type { Snapshot } from '@/lib/types';
import { formatEuro, formatPercent, formatDays, formatNumber } from '@/lib/format';
import ChartCard from './ChartCard';
import { ChartTooltip } from './charts/ChartTooltip';
import { ChartLegend } from './charts/ChartLegend';
import { ChartDefs, grad } from './charts/Defs';
import { AXIS_TICK, CHART } from './charts/theme';

const compactEuro = (v: number) => (Math.abs(v) >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`);

export default function TrendsView({ snapshot }: { snapshot: Snapshot }) {
  const [gran, setGran] = useState<Granularity>(snapshot.weeks.length > 16 ? 'month' : 'week');
  const data = useMemo(() => buildTimeSeries(snapshot, gran), [snapshot, gran]);

  const t = snapshot.revenue.totals;
  const rt = snapshot.runTime.totals;

  const xAxis = (
    <XAxis
      dataKey="label"
      tick={AXIS_TICK}
      axisLine={{ stroke: CHART.grid }}
      tickLine={false}
      tickMargin={8}
      minTickGap={16}
    />
  );
  const grid = <CartesianGrid stroke={CHART.grid} strokeDasharray="2 5" vertical={false} />;

  return (
    <div>
      {/* Samenvatting over de geselecteerde periode (o.b.v. geaccepteerde offertes) */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryStat label="Omzet geaccepteerd" value={formatEuro(t.acceptedRevenue)} sub="ex. btw" />
        <SummaryStat label="Totale marge" value={formatEuro(t.totalMargin)} sub="op vloeromzet" />
        <SummaryStat label="Gem. marge" value={formatPercent(t.avgMarginPct)} sub="gewogen" />
        <SummaryStat label="Gem. doorlooptijd" value={formatDays(rt.avgRunTimeDays)} sub={`${rt.dealsTracked} deals`} />
        <SummaryStat label="M² verkocht" value={formatNumber(t.m2Sold)} sub={`${t.acceptedCount} offertes`} />
      </div>

      <div className="mb-4 flex items-center justify-end gap-2">
        <span className="text-xs text-ink-faint">Weergave:</span>
        <div className="flex rounded-lg border border-line bg-white p-0.5 text-xs">
          {(['week', 'month'] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGran(g)}
              className={`rounded-md px-3 py-1 font-medium transition ${
                gran === g ? 'bg-ink text-white' : 'text-ink-mute hover:text-ink'
              }`}
            >
              {g === 'week' ? 'Per week' : 'Per maand'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Omzetverloop" subtitle="Geaccepteerde vs. open offertes (ex. btw) — niet gefactureerd">
          <ChartLegend
            items={[
              { label: 'Geaccepteerd', color: CHART.accepted },
              { label: 'Open', color: CHART.open },
            ]}
          />
          <ResponsiveContainer width="100%" height={262}>
            <AreaChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
              <ChartDefs />
              {grid}
              {xAxis}
              <YAxis tickFormatter={compactEuro} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
                content={
                  <ChartTooltip
                    format={(v) => formatEuro(v, true)}
                    dotColors={{ acceptedRevenue: CHART.accepted, openRevenue: CHART.open }}
                  />
                }
              />
              <Area type="monotone" dataKey="acceptedRevenue" name="Geaccepteerd" stroke={CHART.accepted}
                strokeWidth={2.4} fill={grad('aAccepted')} dot={false}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff' }} />
              <Area type="monotone" dataKey="openRevenue" name="Open" stroke={CHART.open}
                strokeWidth={2.4} fill={grad('aOpen')} dot={false}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff' }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cumulatieve omzet" subtitle="Opgeteld geaccepteerd (ex. btw)">
          <ChartLegend items={[{ label: 'Opgeteld geaccepteerd', color: CHART.accepted }]} />
          <ResponsiveContainer width="100%" height={262}>
            <AreaChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
              <ChartDefs />
              {grid}
              {xAxis}
              <YAxis tickFormatter={compactEuro} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
                content={<ChartTooltip format={(v) => formatEuro(v)} dotColors={{ cumulativeAccepted: CHART.accepted }} />}
              />
              <Area type="monotone" dataKey="cumulativeAccepted" name="Cumulatief" stroke={CHART.accepted}
                strokeWidth={2.4} fill={grad('aAccepted')} dot={false}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff' }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Marge-verloop" subtitle="Marge o.b.v. geaccepteerde offertes — € (bars) en % (lijn)">
          <ChartLegend
            items={[
              { label: 'Marge (€)', color: CHART.margin },
              { label: 'Marge (%)', color: CHART.marginPct, dashed: true },
            ]}
          />
          <ResponsiveContainer width="100%" height={262}>
            <ComposedChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
              <ChartDefs />
              {grid}
              {xAxis}
              <YAxis yAxisId="eur" tickFormatter={compactEuro} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
              <YAxis yAxisId="pct" orientation="right" tickFormatter={(v) => `${v}%`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                cursor={{ fill: CHART.cursor, radius: 6 }}
                content={
                  <ChartTooltip
                    format={(v, k) => (k === 'marginPct' ? formatPercent(v) : formatEuro(v, true))}
                    dotColors={{ margin: CHART.margin, marginPct: CHART.marginPct }}
                  />
                }
              />
              <Bar yAxisId="eur" dataKey="margin" name="Marge (€)" fill={grad('gMargin')} radius={[4, 4, 2, 2]} maxBarSize={34} />
              <Line yAxisId="pct" type="monotone" dataKey="marginPct" name="Marge (%)" stroke={CHART.marginPct}
                strokeWidth={2.2} strokeDasharray="5 4" dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Doorlooptijd & volume" subtitle="Geaccepteerde offertes (#) en gem. looptijd (dagen)">
          <ChartLegend
            items={[
              { label: 'Geaccepteerd (#)', color: CHART.accepted },
              { label: 'Doorlooptijd (d)', color: CHART.open, dashed: true },
            ]}
          />
          <ResponsiveContainer width="100%" height={262}>
            <ComposedChart data={data} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
              <ChartDefs />
              {grid}
              {xAxis}
              <YAxis yAxisId="count" tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
              <YAxis yAxisId="days" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} />
              <Tooltip
                cursor={{ fill: CHART.cursor, radius: 6 }}
                content={
                  <ChartTooltip
                    format={(v, k) => (k === 'avgRunTime' ? formatDays(v) : `${v} offertes`)}
                    dotColors={{ acceptedCount: CHART.accepted, avgRunTime: CHART.open }}
                  />
                }
              />
              <Bar yAxisId="count" dataKey="acceptedCount" name="Geaccepteerd (#)" fill={grad('gAccepted')} radius={[4, 4, 2, 2]} maxBarSize={34} />
              <Line yAxisId="days" type="monotone" dataKey="avgRunTime" name="Doorlooptijd (d)" stroke={CHART.open}
                strokeWidth={2.2} strokeDasharray="5 4" dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-3 shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
      <div className="text-[11px] font-semibold text-ink-soft">{label}</div>
      <div className="mt-1.5 text-[19px] font-bold leading-none tabular-nums text-ink">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-ink-faint">{sub}</div>}
    </div>
  );
}
