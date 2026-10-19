'use client';

import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { cn } from '@/components/ui';
import { BENTO } from '@/components/overview/cards';

export interface HighlightPoint {
  label: string;
  value: number;
  /** Lopende periode: lichter gearceerd en standaard niet gemarkeerd. */
  current?: boolean;
  /** Niet meetellen (bv. een maand waarin de boekhouding nog niet compleet was): nog lichter. */
  muted?: boolean;
}

export interface HighlightSeries {
  key: string;
  label: string;
  points: HighlightPoint[];
  fmt: (v: number) => string;
  /** Kop boven het grote getal, bv. "Resultaat · per maand". */
  title: string;
  /** Het grote getal: standaard de som van de punten (zonder gedempte). */
  total?: number;
  /** Regel onder het grote getal. */
  sub?: string;
  /** Welk punt standaard gemarkeerd is (anders: de laatste volle periode). */
  highlight?: number;
  /** Korte notatie op de as (bv. €40k). Standaard: duizendtallen als "k". */
  axisFmt?: (v: number) => string;
}

const kortGetal = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`);
export const kortEuro = (v: number) => `€${kortGetal(v)}`;

/** Pad voor een staaf met alleen ronde hoeken aan de buitenkant (boven, of onder bij negatief). */
function staafPad(x: number, y: number, w: number, h: number, r: number, onderRond: boolean): string {
  const rr = Math.min(r, w / 2, h);
  if (onderRond) {
    return `M${x},${y} H${x + w} V${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} H${x + rr} Q${x},${y + h} ${x},${y + h - rr} Z`;
  }
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

/** Pilknoppen, zoals overal in de nieuwe stijl. */
export function Pills<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { key: T; label: string }[] }) {
  return (
    <div className="flex rounded-full bg-sunk p-1 text-[12.5px]">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            'whitespace-nowrap rounded-full px-3.5 py-1.5 font-medium transition',
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
 * De hoofdgrafiek van elke pagina in de nieuwe stijl: pilstaven, de context
 * gearceerd, één staaf in merkgroen met zijn waarde in een zwarte ballon.
 * Standaard gemarkeerd: de laatste volle periode. Negatieve waarden (een
 * verliesmaand) hangen onder de nullijn, in rood gearceerd.
 *
 * Eén of meer reeksen; met meer dan één verschijnt een pilschakelaar. `extra`
 * komt rechtsboven naast die schakelaar (bv. week/maand).
 */
export default function HighlightChart({
  series,
  extra,
  footnote,
  height = 260,
}: {
  series: HighlightSeries[];
  extra?: ReactNode;
  footnote?: ReactNode;
  height?: number;
}) {
  const [key, setKey] = useState(series[0]?.key);
  const [hover, setHover] = useState<number | null>(null);
  const s = series.find((x) => x.key === key) ?? series[0];
  if (!s) return null;

  const data = s.points.map((p) => ({ ...p, v: p.value }));
  let laatsteVol = data.length - 1;
  while (laatsteVol > 0 && (data[laatsteVol].current || data[laatsteVol].muted)) laatsteVol--;
  const actief = hover ?? s.highlight ?? laatsteVol;
  const punt = data[actief];
  const totaal = s.total ?? data.filter((p) => !p.muted).reduce((t, p) => t + p.value, 0);
  const heeftNegatief = data.some((p) => p.value < 0);

  return (
    <div className={cn(BENTO, 'p-6')}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[13.5px] font-medium text-ink-soft">{s.title}</p>
          <p className="mt-1.5 text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink">{s.fmt(totaal)}</p>
          {s.sub && <p className="mt-2 text-[12px] text-ink-faint">{s.sub}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {series.length > 1 && (
            <Pills
              value={s.key}
              onChange={(k) => {
                setKey(k);
                setHover(null);
              }}
              options={series.map((x) => ({ key: x.key, label: x.label }))}
            />
          )}
          {extra}
        </div>
      </div>

      <div className="mt-4" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 40, right: 4, left: 0, bottom: 0 }}
            barCategoryGap="26%"
            maxBarSize={48}
            onMouseMove={(st) => {
              const i = Number(st?.activeTooltipIndex);
              if (Number.isFinite(i)) setHover(i);
            }}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="hcBrand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22cb63" />
                <stop offset="100%" stopColor="#17a752" />
              </linearGradient>
              <linearGradient id="hcRood" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c0503f" />
                <stop offset="100%" stopColor="#a93b2c" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#ece8e1" strokeDasharray="3 5" />
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
            {/* Een as met bedragen en een dun raster: zonder kon je alleen het
                gemarkeerde getal aflezen. Bij een verliesmaand een volle nullijn. */}
            <YAxis
              width={46}
              axisLine={false}
              tickLine={false}
              tickMargin={6}
              tick={{ fill: '#a8a29e', fontSize: 11 }}
              tickFormatter={s.axisFmt ?? kortGetal}
              domain={heeftNegatief ? ['auto', 'auto'] : [0, 'auto']}
            />
            {heeftNegatief && <ReferenceLine y={0} stroke="#cfc8be" />}
            <Bar
              dataKey="v"
              animationDuration={700}
              shape={(props: unknown) => {
                const { x, y, width, height: h0, index } = props as { x: number; y: number; width: number; height: number; index: number };
                const p = data[index];
                const neg = (p?.v ?? 0) < 0;
                // Recharts geeft de hoogte bij een negatieve waarde soms negatief
                // door; de bovenrand is dan de nullijn.
                const h = Math.max(Math.abs(h0), 2);
                const top = neg ? Math.min(y, y + h0) : y + Math.abs(h0) - h;
                const isActief = index === actief;
                // Effen kleuren: gemarkeerd in merkgroen (of rood bij verlies),
                // de rest lichtgrijs; de lopende periode nog lichter.
                const fill = isActief
                  ? neg
                    ? 'url(#hcRood)'
                    : 'url(#hcBrand)'
                  : neg
                    ? '#efd2cb'
                    : p?.current || p?.muted
                      ? '#efece7'
                      : '#e2ddd5';
                const ballonY = neg ? top + h + 32 : top - 10;
                return (
                  <g>
                    <path d={staafPad(x, top, width, h, 8, neg)} fill={fill} style={{ transition: 'fill .2s' }} />
                    {isActief && punt && (
                      <g transform={`translate(${x + width / 2}, ${ballonY})`}>
                        <rect x={-50} y={-26} width={100} height={24} rx={12} fill="#131313" />
                        <text x={0} y={-10} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#fff">
                          {s.fmt(punt.v)}
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
      {footnote && <p className="mt-1 text-right text-[11px] text-ink-faint">{footnote}</p>}
    </div>
  );
}
