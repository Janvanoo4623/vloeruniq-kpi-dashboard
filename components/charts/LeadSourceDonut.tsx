'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { LeadSource } from '@/lib/types';
import { formatEuro } from '@/lib/format';
import { ChartTooltip } from './ChartTooltip';
import { SOURCE_COLORS } from './theme';

export default function LeadSourceDonut({ data }: { data: LeadSource[] }) {
  const total = data.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto h-[200px] w-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="revenue"
              nameKey="name"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip format={(v) => formatEuro(v, true)} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-neutral-400">Totaal</span>
          <span className="text-lg font-semibold text-neutral-900">{formatEuro(total)}</span>
        </div>
      </div>

      <ul className="space-y-2">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.revenue / total) * 100) : 0;
          return (
            <li key={d.name} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-neutral-600">{d.name}</span>
              <span className="shrink-0 tabular-nums text-neutral-400">{pct}%</span>
              <span className="w-24 shrink-0 text-right tabular-nums font-medium text-neutral-900">
                {formatEuro(d.revenue)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
