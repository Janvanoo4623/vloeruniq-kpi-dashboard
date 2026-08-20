// Marktaandeel per gemeente: eigen offertes afgezet tegen het aantal
// verhuisbewegingen uit CBS.
//
// De redenering: wie verhuist koopt een vloer. Het aantal verhuizingen in een
// gemeente is daarmee een maat voor de vraag daar. Zet je eigen offertes daar
// tegen af, en je ziet niet waar je de meeste omzet haalt (dat weet je al) maar
// waar je ondervertegenwoordigd bent — en dat is een advertentiebeslissing.
//
// Belangrijk: dit is een verhouding, geen echt marktaandeel. Niet elke verhuizer
// koopt een vloer en niet elke vloerklant verhuist. De maat is alleen bruikbaar
// om gemeenten ONDERLING te vergelijken, nooit als absoluut percentage.
import type { QuotationRow } from './types';
import { normaliseCity } from './insights';
import { gemeenteCodeVoor, type CbsMove } from './cbs';
import { countsAsLost, type KpiSettings } from './kpi-settings';

const DAY = 86400000;

export interface MarketShareRow {
  gemeente: string; // CBS-naam
  code: string; // GM....
  plaatsen: string[]; // eigen plaatsnamen die hieronder vallen
  quotes: number; // uitgewerkte offertes
  won: number;
  winRate: number | null;
  revenue: number;
  /** Verhuisbewegingen in dezelfde periode (binnen gemeente + gevestigd). */
  moves: number;
  /** Offertes per 1.000 verhuisbewegingen — de vergelijkingsmaat. */
  perThousand: number | null;
  /** Omzet per verhuisbeweging, in euro. */
  revenuePerMove: number | null;
}

export interface MarketShareOverview {
  rows: MarketShareRow[];
  /** Laatste maand waarvoor CBS cijfers heeft — de reeks loopt achter. */
  cbsThrough: string | null;
  /** Periode waarover offertes zijn geteld, zodat het eerlijk vergelijkt. */
  from: string;
  to: string;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Bouw de vergelijking. `movesByCode` bevat per gemeente de CBS-maandreeks; we
 * knippen die op dezelfde periode als de offertes, anders vergelijk je een half
 * jaar vraag met twee jaar offertes.
 */
export function buildMarketShare(
  quotations: QuotationRow[],
  movesByCode: Record<string, CbsMove[]>,
  gemeenteNamen: Record<string, string>,
  asOf: string,
  settings: KpiSettings,
): MarketShareOverview {
  // CBS loopt achter. De vergelijkingsperiode eindigt daarom bij de laatste maand
  // die CBS heeft, niet bij vandaag -- anders tel je offertes in maanden waarvoor
  // er per definitie nul verhuizingen bekend zijn.
  const alleMaanden = Object.values(movesByCode).flatMap((rows) => rows.map((r) => r.period));
  const cbsThrough = alleMaanden.length > 0 ? alleMaanden.sort().slice(-1)[0] : null;
  const cbsFrom = alleMaanden.length > 0 ? alleMaanden.sort()[0] : null;
  if (!cbsThrough || !cbsFrom) {
    return { rows: [], cbsThrough: null, from: '', to: '' };
  }

  const from = `${cbsFrom}-01`;
  // Echte laatste dag van de maand, niet blind "-31": dat werkt lexicaal wel voor
  // het filter maar levert een datum op die niet bestaat zodra je hem toont.
  const [jaar, maand] = cbsThrough.split('-').map(Number);
  const to = `${cbsThrough}-${String(new Date(Date.UTC(jaar, maand, 0)).getUTCDate()).padStart(2, '0')}`;

  const perCode = new Map<
    string,
    { plaatsen: Set<string>; quotes: number; won: number; revenue: number }
  >();

  for (const q of quotations) {
    const datum = q.dateAccepted || q.dateCreated;
    if (!datum || datum < from || datum > to) continue;
    const plaats = normaliseCity(q.city ?? '');
    if (!plaats) continue;
    const code = gemeenteCodeVoor(plaats);
    if (!code) continue; // gemeente niet in de vertaaltabel — bewust overslaan

    const gewonnen = q.status === 'accepted';
    const age = q.dateCreated ? Math.floor((Date.parse(asOf) - Date.parse(q.dateCreated)) / DAY) : 0;
    const verloren = !gewonnen && countsAsLost(q.status, age, settings);
    if (!gewonnen && !verloren) continue; // nog onbeslist

    const e = perCode.get(code) ?? { plaatsen: new Set<string>(), quotes: 0, won: 0, revenue: 0 };
    e.plaatsen.add(plaats);
    e.quotes += 1;
    if (gewonnen) {
      e.won += 1;
      e.revenue += q.revenueExVat;
    }
    perCode.set(code, e);
  }

  const rows: MarketShareRow[] = [];
  for (const [code, e] of perCode) {
    const reeks = movesByCode[code] ?? [];
    const moves = reeks.reduce((s, r) => s + r.demand, 0);
    rows.push({
      gemeente: gemeenteNamen[code] ?? code,
      code,
      plaatsen: [...e.plaatsen].sort(),
      quotes: e.quotes,
      won: e.won,
      winRate: e.quotes >= settings.minSample ? round1((e.won / e.quotes) * 100) : null,
      revenue: Math.round(e.revenue),
      moves,
      // Onder 200 verhuisbewegingen is de verhouding te grillig om iets te zeggen.
      perThousand: moves >= 200 ? round1((e.quotes / moves) * 1000) : null,
      revenuePerMove: moves >= 200 ? round1(e.revenue / moves) : null,
    });
  }

  rows.sort((a, b) => (b.perThousand ?? -1) - (a.perThousand ?? -1));
  return { rows, cbsThrough, from, to };
}
