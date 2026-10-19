'use client';

import { useState, type ReactNode } from 'react';
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
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
            margin={{ top: 44, right: 4, left: 4, bottom: 0 }}
            barCategoryGap="30%"
            maxBarSize={40}
            onMouseMove={(st) => {
              const i = Number(st?.activeTooltipIndex);
              if (Number.isFinite(i)) setHover(i);
            }}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <pattern id="hcHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="7" height="7" fill="#f1eee9" />
                <line x1="0" y1="0" x2="0" y2="7" stroke="#dcd6cd" strokeWidth="2.4" />
              </pattern>
              <pattern id="hcHatchLicht" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="7" height="7" fill="#f7f5f2" />
                <line x1="0" y1="0" x2="0" y2="7" stroke="#ebe7e0" strokeWidth="2.4" />
              </pattern>
              <pattern id="hcHatchRood" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="7" height="7" fill="#f9e9e5" />
                <line x1="0" y1="0" x2="0" y2="7" stroke="#e8bfb6" strokeWidth="2.4" />
              </pattern>
              <linearGradient id="hcBrand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22cb63" />
                <stop offset="100%" stopColor="#16a34f" />
              </linearGradient>
              <linearGradient id="hcRood" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c0503f" />
                <stop offset="100%" stopColor="#a93b2c" />
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
            {/* Verborgen as, alleen zodat er bij een verliesmaand een echte
                nullijn is en de staven daarop staan in plaats van te zweven. */}
            <YAxis hide domain={heeftNegatief ? ['dataMin', 'dataMax'] : [0, 'dataMax']} />
            {heeftNegatief && <ReferenceLine y={0} stroke="#d6d0c7" strokeDasharray="4 4" />}
            <Bar
              dataKey="v"
              animationDuration={700}
              shape={(props: unknown) => {
                const { x, y, width, height: h0, index } = props as { x: number; y: number; width: number; height: number; index: number };
                const p = data[index];
                const neg = (p?.v ?? 0) < 0;
                // Recharts geeft bij een negatieve waarde een negatieve hoogte.
                const hoogte = Math.abs(h0);
                const h = Math.max(hoogte, width);
                // Bij een negatieve waarde begint de staaf aan de nullijn (de
                // bovenrand van wat Recharts doorgeeft, ongeacht het teken).
                const top = neg ? Math.min(y, y + h0) : y + hoogte - h;
                const isActief = index === actief;
                const fill = isActief
                  ? neg
                    ? 'url(#hcRood)'
                    : 'url(#hcBrand)'
                  : neg
                    ? 'url(#hcHatchRood)'
                    : p?.current || p?.muted
                      ? 'url(#hcHatchLicht)'
                      : 'url(#hcHatch)';
                const ballonY = neg ? top + h + 32 : top - 12;
                return (
                  <g>
                    <rect x={x} y={top} width={width} height={h} rx={width / 2} fill={fill} />
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
