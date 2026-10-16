// Grafiekkleuren, afgeleid van de app-tokens in globals.css.
//
// De reeks is bewust géén regenboog: geaccepteerd is het petrol accent (de kleur
// van "dit is binnen"), open is eiken (de kleur van m² en voorraad), en geweigerd
// is het enige rood in de set. Marge en doorlooptijd krijgen eigen tinten die
// niet met een status verward kunnen worden.

export const CHART = {
  grid: '#e7e2da', // line
  axis: '#a8a29e', // ink-faint
  text: '#857f78', // ink-mute
  cursor: 'rgba(28,25,23,0.04)',

  accepted: '#0e6b63', // accent — binnengehaald
  open: '#b4762a', // oak — nog open
  refused: '#a93b2c', // crit — geweigerd
  expired: '#a8a29e', // ink-faint — verlopen: verloren, maar niemand zei nee

  margin: '#2f7a4e', // good — marge in euro's
  marginPct: '#a8761b', // warn — marge in procenten
  runTime: '#0e6b63', // accent — doorlooptijd
  deals: '#e7e2da', // line — achtergrondstaven

  // Marketing: kosten zijn geld dat weggaat, dus geen accent en geen rood —
  // leisteen, neutraal. Conversies krijgen het accent: dat is wat binnenkomt.
  adsCost: '#6b7f8e',
  adsConversions: '#0e6b63',
  // Meta naast Google: ook gedempt, maar een andere tint, zodat de gestapelde
  // balk in de rekensom twee herkenbare delen heeft zonder dat er rood in komt.
  metaCost: '#5f6ea0',
} as const;

/**
 * Donut-palet voor leadbronnen. Begint bij de twee huisaccenten en waaiert dan
 * uit in tinten die daar naast passen; rood blijft eruit, dat betekent iets.
 */
export const SOURCE_COLORS = [
  '#0e6b63', // petrol
  '#b4762a', // eiken
  '#2f7a4e', // groen
  '#4a8f9c', // blauwgroen
  '#8a6f4e', // taupe
  '#5d7a5a', // olijf
  '#a8761b', // amber
  '#6b7f8e', // leisteen
];

export const AXIS_TICK = { fill: CHART.text, fontSize: 11.5 } as const;

/**
 * Kleur per leadbron op náám, niet op volgorde. Op volgorde kreeg Google in de
 * donut petrol en in het verloop eiken, omdat de twee grafieken anders
 * sorteren. "Onbekend" is geen bron maar een gat in de data en krijgt daarom
 * een neutraal grijs; Social media (Meta) dezelfde tint als Meta op Marketing.
 */
const VASTE_BRONKLEUR: Record<string, string> = {
  google: '#0e6b63',
  'social media': '#5f6ea0',
  'mond op mond reclame': '#b4762a',
  netwerk: '#4a8f9c',
  onbekend: '#cfc8be',
};

export function sourceColor(name: string): string {
  const key = name.trim().toLowerCase();
  if (VASTE_BRONKLEUR[key]) return VASTE_BRONKLEUR[key];
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const vrij = SOURCE_COLORS.filter((c) => !Object.values(VASTE_BRONKLEUR).includes(c));
  return vrij[h % vrij.length];
}
