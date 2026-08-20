// De standaardperiode, op één plek. Server en client moeten hier hetzelfde
// antwoord geven: de layout rendert de eerste weergave, de client zet de
// periodekiezer erop. Lopen die uiteen, dan zegt de kop iets anders dan de
// grafiek eronder toont.
const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().split('T')[0];

/** Waar het dashboard op opent. Dagelijks kijken gaat over de afgelopen maand. */
export const DEFAULT_PRESET = '30';

/**
 * Server-variant van presetRange uit DateRangePicker. Bewust een aparte functie:
 * die component is 'use client' en kan niet vanuit een server component worden
 * geïmporteerd zonder de hele kalender mee te slepen.
 */
export function presetRangeServer(preset: string): { from: string; to: string } {
  const t = iso(Date.now());
  switch (preset) {
    case '30':
      return { from: iso(Date.now() - 29 * DAY), to: t };
    case '90':
      return { from: iso(Date.now() - 89 * DAY), to: t };
    case '180':
      return { from: iso(Date.now() - 179 * DAY), to: t };
    case '365':
      return { from: iso(Date.now() - 364 * DAY), to: t };
    case 'ytd':
      return { from: `${new Date().getUTCFullYear()}-01-01`, to: t };
    case 'all':
      return { from: '2000-01-01', to: t };
    default:
      return { from: iso(Date.now() - 29 * DAY), to: t };
  }
}
