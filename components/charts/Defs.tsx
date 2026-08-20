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
];

const AREA_GRADIENTS: Stop[] = [
  { id: 'aAccepted', color: CHART.accepted, from: 0.26, to: 0 },
  { id: 'aOpen', color: CHART.open, from: 0.24, to: 0 },
  { id: 'aMargin', color: CHART.margin, from: 0.26, to: 0 },
  { id: 'aRunTime', color: CHART.runTime, from: 0.22, to: 0 },
];

export function ChartDefs() {
  return (
    <defs>
      {BAR_GRADIENTS.map(({ id, color }) => (
        <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={1} />
          <stop offset="100%" stopColor={color} stopOpacity={0.55} />
        </linearGradient>
      ))}
      {AREA_GRADIENTS.map(({ id, color, from = 0.25, to = 0 }) => (
        <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={from} />
          <stop offset="100%" stopColor={color} stopOpacity={to} />
        </linearGradient>
      ))}
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
