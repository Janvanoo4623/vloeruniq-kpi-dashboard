// Overige producten: alles wat Vloeruniq verkoopt naast vloeren per m² —
// traprenovaties, plinten, tapijt, entreematten en het verwijderen van vloeren.
//
// Waarom dit er is. Jan (2026-11-05): "We doen ook regelmatig traprenovaties,
// deze kan ik toevoegen onder Instellingen > Prijzen, de prijs is per trede.
// Hetzelfde voor tapijt, entreematten, verwijderen van vloeren." Tot nu toe
// sloeg de app elke regel met "trap" bewust over en negeerde hij alles wat niet
// met een vloertype begon. Gemeten op alle geaccepteerde en open offertes
// (2026-11-05): €81k traprenovatie, €72k plinten, €17k tapijt, €4k verwijderen
// en €1,5k entreematten zonder kostprijs, dus zonder marge.
//
// Hoe het werkt. Een regel krijgt een van een VASTE lijst codes, met een eigen
// eenheid. Jan vult per code één kostprijs per eenheid in onder Instellingen →
// Prijzen. Er komt geen ondervloer of legtarief per m² bij, en de regel telt
// niet mee in "m² verkocht".
//
// Sinds 2026-11-19 is die kostprijs het MATERIAAL; de arbeid komt er per
// categorie bij (lib/labor.ts, besluit gesprek Jan 2026-11-18). Dat draait de
// keuze "één bedrag incl. montage" van 2026-11-05 terug. Er stond toen maar één
// prijs (Plinten €4,36/m), en dat was al materiaal.
//
// Waarom een vaste lijst en geen afgeleide namen zoals bij vloeren. Een
// kostprijs per trede mag nooit op een vloerregel belanden, en een vloerprijs
// nooit op een trede. Met vaste codes kan de vloermatching ze uitsluiten
// (`isExtraCode`), en Jan ziet precies welke prijzen er nodig zijn.
//
// Elke regel hieronder is gecontroleerd tegen de echte tekst van 432 offertes en
// 382 facturen (zie docs/DATA-MODEL.md, "Overige producten"). Pas een patroon
// nooit aan zonder dat opnieuw te doen: een geraden patroon heeft eerder alle
// vloer-m² op nul gezet.

import { FLOOR_HEATING_PRICE_CODES } from './floor-heating';

export type ExtraUnit = 'trede' | 'trap' | 'm1' | 'lengte' | 'm2' | 'stuk' | 'groep';

export const UNIT_LABEL: Record<ExtraUnit, string> = {
  trede: 'per trede',
  trap: 'per trap',
  m1: 'per meter',
  lengte: 'per lengte',
  m2: 'per m²',
  stuk: 'per stuk',
  groep: 'per groep',
};

/** Korte eenheid achter een aantal ("13 treden", "60 m"). */
export function formatQty(qty: number, unit: ExtraUnit): string {
  const n = Math.round(qty * 100) / 100;
  const s = n.toLocaleString('nl-NL');
  switch (unit) {
    case 'trede':
      return `${s} ${n === 1 ? 'trede' : 'treden'}`;
    case 'trap':
      return `${s} ${n === 1 ? 'trap' : 'trappen'}`;
    case 'm1':
      return `${s} m`;
    case 'lengte':
      return `${s} ${n === 1 ? 'lengte' : 'lengtes'}`;
    case 'm2':
      return `${s} m²`;
    case 'stuk':
      return `${s}×`;
    case 'groep':
      return `${s} ${n === 1 ? 'groep' : 'groepen'}`;
  }
}

/** Alle codes met hun eenheid. De volgorde is de volgorde in Instellingen. */
export const EXTRA_PRODUCTS: { code: string; unit: ExtraUnit }[] = [
  { code: 'Traprenovatie PVC dichte trap', unit: 'trede' },
  { code: 'Traprenovatie PVC open trap', unit: 'trede' },
  { code: 'Traprenovatie overzettreden', unit: 'trede' },
  { code: 'Traprenovatie PVC (hele trap)', unit: 'trap' },
  { code: 'Traprenovatie tapijt', unit: 'trap' },
  { code: 'Plinten', unit: 'm1' },
  { code: 'Plinten (per lengte)', unit: 'lengte' },
  { code: 'Plinten (alleen leveren)', unit: 'm1' },
  { code: 'Plinten (alleen montage)', unit: 'm1' },
  { code: 'Tapijt', unit: 'm2' },
  { code: 'Tapijt (vast bedrag)', unit: 'stuk' },
  { code: 'Entreemat', unit: 'm2' },
  { code: 'Entreemat (per strekkende meter)', unit: 'm1' },
  { code: 'Vloer verwijderen', unit: 'm2' },
  { code: 'Vloer verwijderen (vast bedrag)', unit: 'stuk' },
  { code: 'Kurkstuc', unit: 'm2' },
  { code: 'Sleuven dichtzetten', unit: 'm2' },
  { code: 'Vloerverwarming', unit: 'groep' },
];

// De staffelcodes van vloerverwarming ("Vloerverwarming 5 groepen") zijn
// prijscodes, geen regelcodes, maar horen net zo min op een vloerregel.
const UNIT_BY_CODE = new Map<string, ExtraUnit>([
  ...EXTRA_PRODUCTS.map((p) => [p.code.toLowerCase(), p.unit] as const),
  ...FLOOR_HEATING_PRICE_CODES.map((p) => [p.code.toLowerCase(), 'stuk' as ExtraUnit] as const),
]);

export const isExtraCode = (code: string): boolean => UNIT_BY_CODE.has(code.trim().toLowerCase());
export const unitOfExtra = (code: string): ExtraUnit | null => UNIT_BY_CODE.get(code.trim().toLowerCase()) ?? null;

export interface ExtraMatch {
  code: string;
  unit: ExtraUnit;
  /**
   * Het aantal dat telt, als dat afwijkt van het aantal op de regel. Alleen bij
   * een hele trap die zijn treden noemt: "Traprenovatie PVC dichte trap 20
   * treden", aantal 1 → 20 treden.
   */
  quantity?: number;
}

// ── Patronen ────────────────────────────────────────────────────────────

// Verwijderen gaat vóór alles: "PVC vloer verwijderen en afvoeren" begint met
// "PVC" en telde tot nu toe als 45 m² vloer met legkosten. Radiatoren zijn geen
// vloer en blijven erbuiten.
const REMOVE_RE = /verwijder|afvoer|\bstrippen\b/i;
const REMOVE_WHAT_RE = /vloer|tapijt|laminaat|pvc|parket|linoleum/i;
const RADIATOR_RE = /radiator/i;
// "Arbeid en materiaal (pvc vloer, strippen, plint)" is een verzamelregel, geen verwijderen.
const ARBEID_EN_MATERIAAL_RE = /^arbeid en materiaal/i;

// Alleen echte traprenovaties. "Trapprofielset", "Traptreden set pvc" (losse
// verkoop), "PVC Visgraat tbv plateau trap" (een vloer) en "Onderzijde trap
// voorzien van PVC" blijven, net als vroeger, buiten beschouwing.
const STAIR_RE = /traprenovatie|overzettrede/i;
const STAIR_CARPET_RE = /tapijt/i;
const STAIR_OVERLAY_RE = /overzettrede/i;
const STAIR_OPEN_RE = /open\s+trap/i;
// Een PVC-trapregel met deze prijs per stuk of meer is een hele trap, geen trede.
// Gemeten: treden €37–€124, hele trappen €526–€1.500.
const WHOLE_STAIR_MIN_PRICE = 300;
// "13 treden", "20 treden": dan is het aantal treden bekend.
const STEP_COUNT_RE = /\b(\d{1,2})\s*treden\b/i;

// Plinten: alleen als "plint" in het eerste deel van de omschrijving staat (vóór
// de eerste |). Zo blijft "Klik PVC Pure ... | Incl. leggen en afwerken met
// plakplint" een vloer. Kit en snijden of kitten langs een bestaande plint zijn
// afwerking en geen plint — maar "Hoge plint 150x12 incl. montage en kitten" is
// wél een plint, dus alleen een regel die met die handeling BEGINT valt af.
const PLINTH_RE = /plint/i;
const PLINTH_NOT_RE = /^(afkitten|kitten|snijden|langs|tegen|extra egaliseren)|plintenkit|plintkit|high ?tack/i;
const PLINTH_PER_LENGTH_RE = /per lengte|lengtes? a/i;
const PLINTH_SUPPLY_ONLY_RE = /alleen leveren|excl\.?\s*montage/i;
const PLINTH_MOUNT_ONLY_RE = /^(plaatsen|monteren)\b/i;

const MAT_RE = /entreemat|droogloopmat|schoonloopmat/i;
const PER_RUNNING_METER_RE = /strekkende meter/i;

// "Vloerbedekking ambian houston" is tapijt van de rol (Glenn en Anne Krommendijk, 2026-11-24).
const CARPET_RE = /tapijt|vloerbedekking/i;
// Tapijt van de rol per strekkende meter (Jan 2026-11-20: "per strekkende meter op
// 4 mtr breed, dus 1x4 = 4m2"). Herkend aan de tekst of aan de prijs: per m² ligt
// tapijt rond €30–52, per strekkende meter rond €90–170. Het aantal wordt m²
// (meters × rolbreedte), zodat materiaal en arbeid allebei per m² rekenen.
const CARPET_PER_M2_RE = /per\s*m(?:2|²)/i;
const CARPET_RUNNING_RE = /strekkende\s*meter/i;
const CARPET_RUNNING_MIN_PRICE = 80;
const ROLL_WIDTH_RE = /\b([345]\d{2})\s*cm\b/i;
const DEFAULT_ROLL_WIDTH_M = 4;

// Kurkstuc/KorqStuc op wanden en plafonds (7 regels in de dump van 2026-11-18).
// Overal in de tekst: "Wand uitvlakken met Ardex R1 | Aanbrengen 2 lagen
// Korqstuc" noemt het pas na de |. Nooit op /stuc/: "PVC Amtico Stucco" is een vloer.
const CORK_PLASTER_RE = /kurkstuc|korqstuc/i;

// Sleuven dichtzetten, altijd per m² (±190 regels). "Naden dichtzetten" en
// "Dichtzetten houten vloer" zijn andere klussen en hebben geen "sleu".
// Een regel met een vast bedrag ("Sleuven dichten, egaliseren, lijmen en leggen
// 2250,- ex btw", aantal 1) is een verzamelregel en blijft erbuiten.
const SLOTS_RE = /sleuv|sleuf/i;

// Vloerverwarming wordt per groep verkocht met aantal 1 ("Vloerverwarming 6
// groepen | incl. plaatsen verdeler"), dus het aantal groepen komt uit de tekst.
// Het aantal op de regel is soms het bedrag incl. btw (2645 bij €2.185): nooit gebruiken.
// "Eventueel meerprijs vloerverwarming" is een optie, geen verkoop.
const FLOOR_HEATING_RE = /vloerverwarm/i;
const GROUPS_RE = /\b(\d{1,2})\s*groepen\b/i;
const OPTIONAL_RE = /^eventueel/i;

const firstPart = (desc: string) => desc.split('|')[0];

/**
 * Welk overig product is deze regel, of null als het er geen is. `unitPrice`
 * is de omzet gedeeld door het aantal; alleen gebruikt om een hele trap van een
 * trede te onderscheiden.
 */
export function classifyExtra(rawDesc: string, quantity: number, revenue: number): ExtraMatch | null {
  const desc = rawDesc.replace(/\s+/g, ' ').trim();
  if (!desc) return null;
  const head = firstPart(desc);
  const unitPrice = quantity > 0 ? revenue / quantity : revenue;
  const fixed = quantity <= 1;

  if (REMOVE_RE.test(head) && REMOVE_WHAT_RE.test(head) && !RADIATOR_RE.test(desc) && !ARBEID_EN_MATERIAAL_RE.test(desc)) {
    return fixed
      ? { code: 'Vloer verwijderen (vast bedrag)', unit: 'stuk' }
      : { code: 'Vloer verwijderen', unit: 'm2' };
  }

  if (STAIR_RE.test(desc)) {
    if (STAIR_CARPET_RE.test(desc)) return { code: 'Traprenovatie tapijt', unit: 'trap' };
    if (STAIR_OVERLAY_RE.test(desc)) return { code: 'Traprenovatie overzettreden', unit: 'trede' };
    const perStep = STAIR_OPEN_RE.test(desc)
      ? { code: 'Traprenovatie PVC open trap', unit: 'trede' as const }
      : { code: 'Traprenovatie PVC dichte trap', unit: 'trede' as const };
    if (unitPrice >= WHOLE_STAIR_MIN_PRICE) {
      const treden = desc.match(STEP_COUNT_RE);
      if (treden && quantity > 0) return { ...perStep, quantity: quantity * Number(treden[1]) };
      return { code: 'Traprenovatie PVC (hele trap)', unit: 'trap' };
    }
    return perStep;
  }

  if (PLINTH_RE.test(head) && !PLINTH_NOT_RE.test(head)) {
    if (PLINTH_MOUNT_ONLY_RE.test(head)) return { code: 'Plinten (alleen montage)', unit: 'm1' };
    if (PLINTH_PER_LENGTH_RE.test(desc)) return { code: 'Plinten (per lengte)', unit: 'lengte' };
    if (PLINTH_SUPPLY_ONLY_RE.test(desc)) return { code: 'Plinten (alleen leveren)', unit: 'm1' };
    return { code: 'Plinten', unit: 'm1' };
  }

  if (MAT_RE.test(head)) {
    return PER_RUNNING_METER_RE.test(desc)
      ? { code: 'Entreemat (per strekkende meter)', unit: 'm1' }
      : { code: 'Entreemat', unit: 'm2' };
  }

  if (CARPET_RE.test(head)) {
    if (fixed) return { code: 'Tapijt (vast bedrag)', unit: 'stuk' };
    const perMeter = !CARPET_PER_M2_RE.test(desc) && (CARPET_RUNNING_RE.test(desc) || unitPrice >= CARPET_RUNNING_MIN_PRICE);
    if (perMeter) {
      const w = desc.match(ROLL_WIDTH_RE);
      const breedte = w ? Number(w[1]) / 100 : DEFAULT_ROLL_WIDTH_M;
      return { code: 'Tapijt', unit: 'm2', quantity: Math.round(quantity * breedte * 100) / 100 };
    }
    return { code: 'Tapijt', unit: 'm2' };
  }

  if (CORK_PLASTER_RE.test(desc) && !fixed) return { code: 'Kurkstuc', unit: 'm2' };

  // Vloerverwarming vóór sleuven: "Vloerverwarming 8 groepen (74m2) | … | sleuven 100mm".
  if (FLOOR_HEATING_RE.test(head) && !SLOTS_RE.test(head) && !OPTIONAL_RE.test(head)) {
    const groepen = desc.match(GROUPS_RE);
    if (groepen) return { code: 'Vloerverwarming', unit: 'groep', quantity: Number(groepen[1]) };
    return null;
  }

  if (SLOTS_RE.test(head) && !fixed) return { code: 'Sleuven dichtzetten', unit: 'm2' };

  return null;
}
