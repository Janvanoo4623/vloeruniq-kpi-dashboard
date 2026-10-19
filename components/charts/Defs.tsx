'use client';

import { CHART } from './theme';

/**
 * Gedeelde SVG-verlopen voor alle grafieken. Eén plek, zodat een staaf op de
 * Overzichtspagina exact dezelfde vulling heeft als op Marge — anders gaat de
 * kleur per pagina net iets anders liggen en valt het uit elkaar.
 *
 * De verlopen zijn subtiel: van vol naar ~55% van dezelfde tint. Zwaardere
 * verlopen zien er op één grafiek aardig uit, maar zodra er zes op een pagina
 * staan wordt het onrustig en gaat het aflezen eronder lijden.
 */

interface Stop {
  id: string;
  color: string;
  /** Dekking boven en onder; staven lopen naar beneden uit, vlakken juist ver. */
  from?: number;
  to?: number;
}

const BAR_GRADIENTS: Stop[] = [
  { id: 'gAccepted', color: CHART.accepted },
  { id: 'gOpen', color: CHART.open },
  { id: 'gRefused', color: CHART.refused },
  { id: 'gExpired', color: CHART.expired },
  { id: 'gMargin', color: CHART.margin },
  { id: 'gRunTime', color: CHART.runTime },
  { id: 'gAdsCost', color: CHART.adsCost },
  { id: 'gMetaCost', color: CHART.metaCost },
];

const AREA_GRADIENTS: Stop[] = [
  { id: 'aAccepted', color: CHART.accepted, from: 0.26, to: 0 },
  { id: 'aOpen', color: CHART.open, from: 0.24, to: 0 },
  // Marge% loopt op de rechteras; het vlak eronder mag de staven (linkeras)
  // niet overstemmen. Bewust lichter dan de andere vlakken.
  { id: 'aMargin', color: CHART.marginPct, from: 0.12, to: 0 },
  { id: 'aRunTime', color: CHART.runTime, from: 0.22, to: 0 },
];

export function ChartDefs() {
  return (
    <defs>
      {BAR_GRADIENTS.map(({ id, color }) => (
        <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={1} />
          <stop offset="100%" stopColor={color} stopOpacity={0.68} />
        </linearGradient>
      ))}
      {/* Drie stops in plaats van twee: vol bovenin, snel zachter, dan weg.
          Dat geeft het vlak diepte zonder dat de onderkant modderig wordt. */}
      {AREA_GRADIENTS.map(({ id, color, from = 0.25, to = 0 }) => (
        <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={Math.min(0.42, from * 1.35)} />
          <stop offset="55%" stopColor={color} stopOpacity={from * 0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={to} />
        </linearGradient>
      ))}
      {/* Gloed onder lijnen: de lijn zelf, vervaagd en half doorzichtig,
          eronder gelegd. Werkt dus in elke kleur zonder per kleur een filter. */}
      <filter id="lineGlow" x="-5%" y="-30%" width="110%" height="160%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="blur" />
        <feComponentTransfer in="blur" result="soft">
          <feFuncA type="linear" slope="0.38" />
        </feComponentTransfer>
        <feOffset in="soft" dy="2.5" result="shifted" />
        <feMerge>
          <feMergeNode in="shifted" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      {/* Donut: een zweem diepte zonder dat het een 3D-taart wordt. */}
      <radialGradient id="donutShade" cx="50%" cy="50%" r="50%">
        <stop offset="70%" stopColor="#000" stopOpacity={0} />
        <stop offset="100%" stopColor="#000" stopOpacity={0.06} />
      </radialGradient>
    </defs>
  );
}

/** `fill`-waarde voor een staaf, met terugval op de vlakke kleur. */
export const grad = (id: string) => `url(#${id})`;

/**
 * Eén verborgen set definities voor de hele app, bovenaan de schil. SVG-id's
 * gelden documentbreed, dus elke grafiek — ook een die zelf geen <ChartDefs>
 * heeft — kan url(#lineGlow) en de verlopen gebruiken. De CSS in globals.css
 * hangt het filter aan elke lijn.
 */
export function GlobalChartDefs() {
  return (
    <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }}>
      <ChartDefs />
    </svg>
  );
}
