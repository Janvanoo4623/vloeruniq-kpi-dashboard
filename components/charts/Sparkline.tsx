'use client';

import { useId } from 'react';

/**
 * Kleine trendlijn in een tegel. Geen assen, geen labels: de tegel zelf draagt
 * het getal, de lijn laat alleen zien of het omhoog of omlaag gaat. Eén reeks,
 * dus geen legenda. De laatste punt krijgt een stip, want dát is het getal
 * dat erboven staat.
 */
export default function Sparkline({
  values,
  color,
  height = 36,
  className,
}: {
  values: number[];
  color: string;
  height?: number;
  className?: string;
}) {
  const id = useId();
  const w = 100;
  const h = height;
  const pad = 3;
  if (values.length < 2) {
    return <div className={className} style={{ height }} aria-hidden />;
  }
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (values.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line = `M${pts.join(' L')}`;
  const area = `${line} L${x(values.length - 1).toFixed(1)},${(h - pad).toFixed(1)} L${x(0).toFixed(1)},${(h - pad).toFixed(1)} Z`;
  const last = values.length - 1;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: '100%', height }}
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last)} cy={y(values[last])} r={2.6} fill={color} stroke="#fff" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
