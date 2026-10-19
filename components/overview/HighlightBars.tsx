'use client';

import { useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis } from 'recharts';
import type { BarPoint, OverviewBars } from '@/lib/today';
import { formatEuro, formatNumber } from '@/lib/format';
import { cn } from '@/components/ui';
import { BENTO } from './cards';

type Metric = 'revenue' | 'margin' | 'm2' | 'count';
const METRICS: { key: Metric; label: string; fmt: (v: number) => string; kop: string }[] = [
  { key: 'revenue', label: 'Omzet', fmt: (v) => formatEuro(v), kop: 'Omzet geaccepteerd' },
  { key: 'margin', label: 'Marge', fmt: (v) => formatEuro(v), kop: 'Marge' },
  { key: 'm2', label: 'M²', fmt: (v) => `${formatNumber(v)} m²`, kop: 'Verkochte m²' },
  { key: 'count', label: 'Offertes', fmt: (v) => formatNumber(v), kop: 'Gewonnen offertes' },
];

/** Pilknoppen, zoals overal in de nieuwe stijl. */
function Pills<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string }[] }) {
  return (
    <div className="flex rounded-full bg-sunk p-1 text-[12.5px]">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            'rounded-full px-3.5 py-1.5 font-medium transition',
            value === o.key ? 'bg-night text-white shadow-sm' : 'text-ink-mute hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * De hoofdgrafiek van Overzicht. Geen assen, geen raster, geen legenda: twaalf
 * pilstaven, de context gearceerd, één staaf in merkgroen met zijn waarde erboven.
 * Standaard is dat de lopende week of maand; met de muis kies je een andere.
 * Het ritme over twaalf weken is de vraag, niet de exacte waarde per staaf.
 */
export default function HighlightBars({ bars }: { bars: OverviewBars }) {
  const [metric, setMetric] = useState<Metric>('revenue');
  const [gran, setGran] = useState<'weeks' | 'months'>('weeks');
  const [hover, setHover] = useState<number | null>(null);

  const m = METRICS.find((x) => x.key === metric)!;
  const data = bars[gran].map((p: BarPoint) => ({ ...p, v: p[metric] }));
  // Standaard de laatste vólle week of maand: de lopende is op maandag nog leeg,
  // en een groen bolletje met "€ 0" erboven zegt niets.
  const laatsteVol = data[data.length - 1]?.current ? data.length - 2 : data.length - 1;
  const actief = hover ?? laatsteVol;
  const totaal = data.reduce((s, p) => s + p.v, 0);
  const gem = data.length > 1 ? data.slice(0, -1).reduce((s, p) => s + p.v, 0) / (data.length - 1) : null;
  const punt = data[actief];

  return (
    <div className={cn(BENTO, 'p-6')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13.5px] font-medium text-ink-soft">
            {m.kop} · laatste 12 {gran === 'weeks' ? 'weken' : 'maanden'}
          </p>
          <p className="mt-1.5 text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink">{m.fmt(totaal)}</p>
          {gem != null && (
            <p className="mt-2 text-[12px] text-ink-faint">
              gemiddeld {m.fmt(Math.round(gem))} per {gran === 'weeks' ? 'week' : 'maand'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pills value={metric} onChange={setMetric} options={METRICS} />
          <Pills
            value={gran}
            onChange={(g) => {
              setGran(g);
              setHover(null);
            }}
            options={[
              { key: 'weeks', label: 'Week' },
              { key: 'months', label: 'Maand' },
            ]}
          />
        </div>
      </div>

      <div className="mt-4 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 44, right: 4, left: 4, bottom: 0 }}
            barCategoryGap="30%"
            maxBarSize={40}
            onMouseMove={(s) => {
              const i = Number(s?.activeTooltipIndex);
              if (Number.isFinite(i)) setHover(i);
            }}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <pattern id="hlHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="7" height="7" fill="#f1eee9" />
                <line x1="0" y1="0" x2="0" y2="7" stroke="#dcd6cd" strokeWidth="2.4" />
              </pattern>
              {/* De lopende periode: nog lichter, want hij is niet af. */}
              <pattern id="hlHatchLicht" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="7" height="7" fill="#f6f4f0" />
                <line x1="0" y1="0" x2="0" y2="7" stroke="#e9e4dc" strokeWidth="2.4" />
              </pattern>
              <linearGradient id="hlBrand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22cb63" />
                <stop offset="100%" stopColor="#16a34f" />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              interval={0}
              tick={(props: { x?: number | string; y?: number | string; payload?: { value: string }; index?: number }) => {
                const isActief = props.index === actief;
                return (
                  <text
                    x={Number(props.x)}
                    y={Number(props.y) + 12}
                    textAnchor="middle"
                    fontSize={11.5}
                    fontWeight={isActief ? 600 : 400}
                    fill={isActief ? '#131313' : '#a8a29e'}
                  >
                    {props.payload?.value}
                  </text>
                );
              }}
            />
            <Bar
              dataKey="v"
              isAnimationActive
              animationDuration={700}
              shape={(props: unknown) => {
                const { x, y, width, height, index } = props as { x: number; y: number; width: number; height: number; index: number };
                const h = Math.max(height, width); // ook een lege week is een rondje, geen gat
                const top = y + height - h;
                const isActief = index === actief;
                return (
                  <g>
                    <rect
                      x={x}
                      y={top}
                      width={width}
                      height={h}
                      rx={width / 2}
                      fill={isActief ? 'url(#hlBrand)' : data[index]?.current ? 'url(#hlHatchLicht)' : 'url(#hlHatch)'}
                      style={{ transition: 'fill .2s' }}
                    />
                    {isActief && punt && (
                      <g transform={`translate(${x + width / 2}, ${top - 12})`}>
                        <rect x={-46} y={-26} width={92} height={24} rx={12} fill="#131313" />
                        <text x={0} y={-10} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#fff">
                          {m.fmt(punt.v)}
                        </text>
                      </g>
                    )}
                  </g>
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-right text-[11px] text-ink-faint">
        {gran === 'weeks' ? 'De lopende week' : 'De lopende maand'} staat lichter: die is nog niet af
      </p>
    </div>
  );
}
