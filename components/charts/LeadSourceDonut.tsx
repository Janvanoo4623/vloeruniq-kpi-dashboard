'use client';

import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { LeadSource } from '@/lib/types';
import { formatEuro } from '@/lib/format';
import { SOURCE_COLORS } from './theme';

/**
 * Donut met een actief segment in plaats van een tooltip: je zweeft over een
 * regel in de lijst óf over de ring, en het middenveld toont dat segment. Eén
 * hero-getal in het midden — niet twee dingen die om aandacht vragen.
 */
export default function LeadSourceDonut({ data }: { data: LeadSource[] }) {
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((sum, d) => sum + d.revenue, 0);
  const shown = active != null ? data[active] : null;
  const shownPct = shown && total > 0 ? Math.round((shown.revenue / total) * 100) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative mx-auto h-[196px] w-[196px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {SOURCE_COLORS.map((c, i) => (
                <linearGradient key={i} id={`src${i}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={c} stopOpacity={1} />
                  <stop offset="100%" stopColor={c} stopOpacity={0.62} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={data}
              dataKey="revenue"
              nameKey="name"
              innerRadius={60}
              outerRadius={88}
              paddingAngle={2.5}
              cornerRadius={4}
              stroke="none"
              isAnimationActive={false}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={`url(#src${i % SOURCE_COLORS.length})`}
                  opacity={active == null || active === i ? 1 : 0.32}
                  style={{ transition: 'opacity .15s', cursor: 'pointer' }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="max-w-full truncate text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
            {shown ? shown.name : 'Totaal'}
          </span>
          <span className="mt-0.5 text-[19px] font-bold tabular-nums leading-tight text-ink">
            {formatEuro(shown ? shown.revenue : total)}
          </span>
          {shownPct != null && (
            <span className="text-[11px] tabular-nums text-ink-mute">{shownPct}% van de omzet</span>
          )}
        </div>
      </div>

      <ul className="space-y-0.5">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.revenue / total) * 100) : 0;
          return (
            <li
              key={d.name}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={`flex cursor-default items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] transition-colors ${
                active === i ? 'bg-sunk' : ''
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-ink-soft">{d.name}</span>
              <span className="shrink-0 tabular-nums text-ink-faint">{pct}%</span>
              <span className="w-[86px] shrink-0 text-right font-semibold tabular-nums text-ink">
                {formatEuro(d.revenue)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
