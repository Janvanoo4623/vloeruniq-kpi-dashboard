'use client';

import { useId } from 'react';

/**
 * Kleine trendlijn in een tegel. Geen assen, geen labels: de tegel zelf draagt
 * het getal, de lijn laat alleen zien of het omhoog of omlaag gaat. Eén reeks,
 * dus geen legenda. Geen eindstip: met preserveAspectRatio="none" wordt een
 * cirkel in een brede tegel een uitgerekt ovaal.
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
  // Vloeiend door elke punt (Catmull-Rom als Bézier). De y van de
  // controlepunten wordt binnen het bereik van de twee buurpunten gehouden,
  // zodat de lijn nooit voorbij een echte waarde uitschiet.
  const P = values.map((v, i) => ({ x: x(i), y: y(v) }));
  const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
  let line = `M${P[0].x.toFixed(1)},${P[0].y.toFixed(1)}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] ?? P[i];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6, p1.y, p2.y);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6, p1.y, p2.y);
    line += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  const area = `${line} L${x(values.length - 1).toFixed(1)},${(h - pad).toFixed(1)} L${x(0).toFixed(1)},${(h - pad).toFixed(1)} Z`;

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
          <stop offset="0%" stopColor={color} stopOpacity={0.1} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      {/* Dun en half doorzichtig: de lijn is achtergrond bij het getal, geen grafiek. */}
      <path d={line} fill="none" stroke={color} strokeOpacity={0.55} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
