'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
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
import { AXIS_TICK, CHART } from './charts/theme';

const compactEuro = (v: number) => (Math.abs(v) >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`);

export default function TrendsView({ snapshot }: { snapshot: Snapshot }) {
  const [gran, setGran] = useState<Granularity>(snapshot.weeks.length > 16 ? 'month' : 'week');
  const data = useMemo(() => buildTimeSeries(snapshot, gran), [snapshot, gran]);

  const t = snapshot.revenue.totals;
  const rt = snapshot.runTime.totals;

  const xAxis = (
    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: CHART.grid }} tickLine={false} minTickGap={16} />
  );

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
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              {xAxis}
              <YAxis tickFormatter={compactEuro} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<ChartTooltip format={(v) => formatEuro(v, true)} />} />
              <Legend wrapperStyle={{ fontSize: 12, color: CHART.text }} />
              <Line type="monotone" dataKey="acceptedRevenue" name="Geaccepteerd" stroke={CHART.accepted} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="openRevenue" name="Open" stroke={CHART.open} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cumulatieve omzet" subtitle="Opgeteld geaccepteerd (ex. btw)">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.accepted} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CHART.accepted} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              {xAxis}
              <YAxis tickFormatter={compactEuro} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<ChartTooltip format={(v) => formatEuro(v)} />} />
              <Area type="monotone" dataKey="cumulativeAccepted" name="Cumulatief" stroke={CHART.accepted} strokeWidth={2} fill="url(#cumFill)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Marge-verloop" subtitle="Marge o.b.v. geaccepteerde offertes — € (bars) en % (lijn)">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              {xAxis}
              <YAxis yAxisId="eur" tickFormatter={compactEuro} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
              <YAxis yAxisId="pct" orientation="right" tickFormatter={(v) => `${v}%`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<ChartTooltip format={(v, k) => (k === 'marginPct' ? formatPercent(v) : formatEuro(v, true))} />} />
              <Legend wrapperStyle={{ fontSize: 12, color: CHART.text }} />
              <Bar yAxisId="eur" dataKey="margin" name="Marge (€)" fill={CHART.margin} radius={[3, 3, 0, 0]} />
              <Line yAxisId="pct" type="monotone" dataKey="marginPct" name="Marge (%)" stroke={CHART.marginPct} strokeWidth={2} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Doorlooptijd & volume" subtitle="Geaccepteerde offertes (#) en gem. looptijd (dagen)">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              {xAxis}
              <YAxis yAxisId="count" tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
              <YAxis yAxisId="days" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<ChartTooltip format={(v, k) => (k === 'avgRunTime' ? formatDays(v) : String(v))} />} />
              <Legend wrapperStyle={{ fontSize: 12, color: CHART.text }} />
              <Bar yAxisId="count" dataKey="acceptedCount" name="Geaccepteerd (#)" fill={CHART.accepted} radius={[3, 3, 0, 0]} />
              <Line yAxisId="days" type="monotone" dataKey="avgRunTime" name="Doorlooptijd (d)" stroke={CHART.runTime} strokeWidth={2} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2.5 shadow-sm">
      <div className="text-xs text-ink-faint">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{value}</div>
      {sub && <div className="text-[11px] text-ink-faint">{sub}</div>}
    </div>
  );
}
