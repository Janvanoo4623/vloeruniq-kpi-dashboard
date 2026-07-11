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
import { formatEuro, formatPercent, formatDays } from '@/lib/format';
import ChartCard from './ChartCard';
import { ChartTooltip } from './charts/ChartTooltip';
import { AXIS_TICK, CHART } from './charts/theme';

const compactEuro = (v: number) => (Math.abs(v) >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`);

export default function TrendsView({ snapshot }: { snapshot: Snapshot }) {
  const [gran, setGran] = useState<Granularity>(snapshot.weeks.length > 16 ? 'month' : 'week');
  const data = useMemo(() => buildTimeSeries(snapshot, gran), [snapshot, gran]);

  const xAxis = (
    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: CHART.grid }} tickLine={false} minTickGap={16} />
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-2">
        <span className="text-xs text-neutral-400">Weergave:</span>
        <div className="flex rounded-lg border border-neutral-200 bg-white p-0.5 text-xs">
          {(['week', 'month'] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGran(g)}
              className={`rounded-md px-3 py-1 font-medium transition ${
                gran === g ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {g === 'week' ? 'Per week' : 'Per maand'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Omzetverloop" subtitle="Geaccepteerd vs. open (ex. btw)">
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

        <ChartCard title="Marge-verloop" subtitle="Marge in € (bars) en % (lijn)">
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

        <ChartCard title="Conversie & doorlooptijd" subtitle="Conversie % en gem. looptijd (dagen)">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              {xAxis}
              <YAxis yAxisId="pct" tickFormatter={(v) => `${v}%`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
              <YAxis yAxisId="days" orientation="right" tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<ChartTooltip format={(v, k) => (k === 'avgRunTime' ? formatDays(v) : formatPercent(v))} />} />
              <Legend wrapperStyle={{ fontSize: 12, color: CHART.text }} />
              <Line yAxisId="pct" type="monotone" dataKey="conversionPct" name="Conversie %" stroke={CHART.marginPct} strokeWidth={2} dot={false} connectNulls />
              <Line yAxisId="days" type="monotone" dataKey="avgRunTime" name="Doorlooptijd (d)" stroke={CHART.runTime} strokeWidth={2} dot={false} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
