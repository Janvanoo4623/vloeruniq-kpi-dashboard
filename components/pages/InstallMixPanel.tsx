'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { InstallMixPoint, InstallModeStat } from '@/lib/insights';
import { formatEuro, formatNumber, formatPercent } from '@/lib/format';
import { AXIS_TICK, CHART } from '@/components/charts/theme';
import { ChartDefs, grad } from '@/components/charts/Defs';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { ChartLegend } from '@/components/charts/ChartLegend';
import { Empty, Panel, cn } from '@/components/ui';

const MODE_COLOR = {
  glued: CHART.accepted,
  click: CHART.open,
  selfadhesive: CHART.margin,
} as const;

/** Onder dit aantal regels is een percentage niet te vertrouwen. */
const MIN_LINES = 20;

/**
 * Gelijmd, klik of zelfklevend — en wat elk oplevert. De vraag eronder is of het
 * klik-aandeel groeit, want daar ligt de marge structureel lager.
 */
export default function InstallMixPanel({
  totals,
  byQuarter,
}: {
  totals: InstallModeStat[];
  byQuarter: InstallMixPoint[];
}) {
  if (totals.length === 0) {
    return (
      <Panel title="Legwijze" subtitle="Gelijmd, klik of zelfklevend">
        <Empty>Nog geen regels met een herkende legwijze.</Empty>
      </Panel>
    );
  }

  const totalM2 = totals.reduce((s, t) => s + t.m2, 0);
  // Percentages alleen tonen waar er genoeg regels onder liggen; zelfklevend
  // haalt die drempel niet en krijgt daarom bewust absolute getallen.
  const thin = totals.filter((t) => t.lines < MIN_LINES);

  return (
    <Panel
      title="Legwijze en wat die oplevert"
      subtitle="Alleen geaccepteerde offertes — een verlopen offerte zegt niets over wat er ligt"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {totals.map((t) => {
          const share = totalM2 > 0 ? Math.round((t.m2 / totalM2) * 100) : 0;
          const reliable = t.lines >= MIN_LINES;
          return (
            <div key={t.mode} className="rounded-xl border border-line bg-canvas/60 p-3.5">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: MODE_COLOR[t.mode] }}
                />
                <span className="text-[12.5px] font-semibold text-ink">{t.label}</span>
                <span className="ml-auto text-[11px] tabular-nums text-ink-faint">
                  {reliable ? `${share}%` : `${t.lines} regels`}
                </span>
              </div>
              <p className="mt-2.5 text-[20px] font-bold leading-none tabular-nums text-ink">
                {formatEuro(t.pricePerM2, true)}
                <span className="ml-1 text-[12px] font-medium text-ink-faint">/m²</span>
              </p>
              <dl className="mt-2.5 space-y-1 text-[11.5px]">
                <div className="flex justify-between">
                  <dt className="text-ink-faint">Marge</dt>
                  <dd
                    className={cn(
                      'font-semibold tabular-nums',
                      reliable ? 'text-ink' : 'text-ink-mute',
                    )}
                  >
                    {formatPercent(t.marginPct)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-faint">Verkocht</dt>
                  <dd className="tabular-nums text-ink-mute">{formatNumber(t.m2)} m²</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>

      {thin.length > 0 && (
        <p className="mt-3 text-[11.5px] text-ink-faint">
          {thin.map((t) => t.label.toLowerCase()).join(' en ')} steunt op{' '}
          {thin.map((t) => t.lines).join(' resp. ')} regels — te weinig voor een percentage, dus lees
          die als indicatie.
        </p>
      )}

      {byQuarter.length >= 2 && (
        <div className="mt-5 border-t border-hair pt-4">
          <ChartLegend
            items={[
              { label: 'Gelijmd', color: MODE_COLOR.glued },
              { label: 'Klik', color: MODE_COLOR.click },
              ...(totals.some((t) => t.mode === 'selfadhesive')
                ? [{ label: 'Zelfklevend', color: MODE_COLOR.selfadhesive }]
                : []),
            ]}
            right={<span className="text-[11px] text-ink-faint">m² per kwartaal</span>}
          />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byQuarter} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <ChartDefs />
              <CartesianGrid stroke={CHART.grid} strokeDasharray="2 5" vertical={false} />
              <XAxis
                dataKey="quarter"
                tick={AXIS_TICK}
                axisLine={{ stroke: CHART.grid }}
                tickLine={false}
                tickMargin={8}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v) => `${Math.round(v)}`}
              />
              <Tooltip
                cursor={{ fill: CHART.cursor, radius: 6 }}
                content={
                  <ChartTooltip
                    format={(v) => `${formatNumber(v)} m²`}
                    dotColors={{
                      glued: MODE_COLOR.glued,
                      click: MODE_COLOR.click,
                      selfadhesive: MODE_COLOR.selfadhesive,
                    }}
                  />
                }
              />
              <Bar stackId="m" dataKey="glued" name="Gelijmd" fill={grad('gAccepted')} maxBarSize={38} />
              <Bar stackId="m" dataKey="selfadhesive" name="Zelfklevend" fill={grad('gMargin')} maxBarSize={38} />
              <Bar
                stackId="m"
                dataKey="click"
                name="Klik"
                fill={grad('gOpen')}
                radius={[4, 4, 0, 0]}
                maxBarSize={38}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
