'use client';

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { KPI_DEFS, type KpiPoint, type KpiUnit } from '@/lib/kpi-series';
import { formatDays, formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { AXIS_TICK, CHART } from './theme';
import { ChartTooltip } from './ChartTooltip';
import { cn } from '@/components/ui';

const compactEuro = (v: number) => (Math.abs(v) >= 1000 ? `€${Math.round(v / 1000)}k` : `€${Math.round(v)}`);

const UNIT_AXIS: Record<KpiUnit, { orientation: 'left' | 'right'; format: (v: number) => string; width: number }> = {
  eur: { orientation: 'left', format: compactEuro, width: 50 },
  count: { orientation: 'right', format: (v) => formatNumber(v), width: 40 },
  pct: { orientation: 'right', format: (v) => `${v}%`, width: 40 },
  days: { orientation: 'right', format: (v) => `${v}d`, width: 36 },
};

const formatValue = (unit: KpiUnit, v: number) =>
  unit === 'eur' ? formatEuro(v, v < 100) : unit === 'pct' ? formatPercent(v) : unit === 'days' ? formatDays(v) : formatNumber(v);

/**
 * Eén grafiek, jij kiest de lijnen. Vraag van Jasper (2026-09-17): "knoppen
 * met KPI's, één of meerdere, assen schalen logisch mee". Elke eenheid krijgt
 * een eigen as — euro's links, aantallen/procenten/dagen rechts — zodat CPC en
 * conversies naast elkaar kunnen zonder dat de ene de andere platdrukt.
 *
 * Kleur volgt de KPI, niet de volgorde: omzet is altijd petrol, ook als je
 * alles eromheen uitzet. De knoppen dragen dezelfde kleur als hun lijn, dus de
 * legenda is de knoppenrij zelf.
 */
export default function KpiTrendChart({ data }: { data: KpiPoint[] }) {
  const [on, setOn] = useState<Set<string>>(() => new Set(KPI_DEFS.filter((d) => d.defaultOn).map((d) => d.key)));
  const active = useMemo(() => KPI_DEFS.filter((d) => on.has(d.key)), [on]);
  const units = useMemo(() => [...new Set(active.map((d) => d.unit))], [active]);

  const toggle = (key: string) =>
    setOn((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // altijd minstens één lijn
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  const hasAds = data.some((p) => Number(p.adsCost ?? 0) > 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {KPI_DEFS.filter((d) => hasAds || !d.key.startsWith('ads') && d.key !== 'marginAfterAds').map((d) => {
          const isOn = on.has(d.key);
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => toggle(d.key)}
              aria-pressed={isOn}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition',
                isOn ? 'border-transparent text-white shadow-sm' : 'border-line bg-surface text-ink-soft hover:border-ink-faint hover:text-ink',
              )}
              style={isOn ? { background: d.color } : undefined}
            >
              {isOn ? (
                <Check size={11} strokeWidth={3} />
              ) : (
                <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: d.color }} />
              )}
              {d.label}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          {/* Licht verloop onder elke lijn, in de kleur van de KPI. Bewust zacht:
              met drie lijnen tegelijk moet de achtergrond niet gaan meedoen. */}
          <defs>
            {KPI_DEFS.map((d) => (
              <linearGradient key={d.key} id={`kpi-${d.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={d.color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={d.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="2 5" vertical={false} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: CHART.grid }} tickLine={false} tickMargin={8} minTickGap={16} />
          {units.map((u) => (
            <YAxis
              key={u}
              yAxisId={u}
              orientation={UNIT_AXIS[u].orientation}
              tickFormatter={UNIT_AXIS[u].format}
              tick={AXIS_TICK}
              axisLine={false}
              tickLine={false}
              width={UNIT_AXIS[u].width}
              allowDecimals={u !== 'count'}
            />
          ))}
          <Tooltip
            cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
            content={
              <ChartTooltip
                format={(v, key) => formatValue(KPI_DEFS.find((d) => d.key === key)?.unit ?? 'count', v)}
                dotColors={Object.fromEntries(KPI_DEFS.map((d) => [d.key, d.color]))}
              />
            }
          />
          {active.map((d) => (
            <Area
              key={d.key}
              yAxisId={d.unit}
              type="monotone"
              dataKey={d.key}
              name={d.label}
              stroke={d.color}
              strokeWidth={2.2}
              fill={`url(#kpi-${d.key})`}
              dot={false}
              activeDot={{ r: 4.5, strokeWidth: 2, stroke: '#fff' }}
              connectNulls
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
