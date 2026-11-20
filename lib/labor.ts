// Arbeid per categorie (besluit gesprek Jan 2026-11-18, docs/DATA-MODEL.md
// "Arbeid per categorie"). Bij overige producten is de kostprijs uit de
// prijslijst het MATERIAAL; de arbeid komt er hier bij, met één tarief per
// categorie. Bij gietvloeren vervangt het tarief het algemene legtarief.
//
// De tarieven staan in cost_settings onder een sleutel met het voorvoegsel
// "arbeid:" (met ingangsdatum, net als de andere kosten). Zonder rij gelden de
// tarieven die Jan op 2026-11-18 mailde. Let op: lib/pricing.ts telt die
// sleutels NIET mee in de kosten per m² — anders werd elk tarief een kostenpost
// op alle vloer, precies de valkuil van het veld "Nieuwe kostenpost".

export const LABOR_PREFIX = 'arbeid:';

export interface LaborCategory {
  key: string;
  label: string;
  unit: string;
  /** Jans tarief van 2026-11-18, ex btw. */
  fallback: number;
  note?: string;
}

export const LABOR_CATEGORIES: LaborCategory[] = [
  { key: 'arbeid:plinten', label: 'Plinten plaatsen', unit: 'per meter', fallback: 10, note: 'per lengte = 2,4 m; alleen leveren = geen arbeid' },
  { key: 'arbeid:trap_pvc', label: 'Traprenovatie PVC', unit: 'per trap', fallback: 360, note: 'bij verkoop per trede: 1 trap per 14 treden' },
  { key: 'arbeid:trap_overzet', label: 'Traprenovatie overzettreden', unit: 'per trap', fallback: 720, note: 'bij verkoop per trede: 1 trap per 14 treden' },
  { key: 'arbeid:trap_tapijt', label: 'Trap met tapijt', unit: 'per trap', fallback: 360 },
  { key: 'arbeid:entreemat', label: 'Entreematten', unit: 'per meter of m²', fallback: 7.5 },
  { key: 'arbeid:tapijt', label: 'Tapijt leggen', unit: 'per m²', fallback: 6, note: '€24 per strekkende meter van een rol van 4 m (Jan 2026-11-20)' },
  { key: 'arbeid:kurkstuc', label: 'Kurkstuc aanbrengen', unit: 'per m²', fallback: 26 },
  { key: 'arbeid:sleuven', label: 'Sleuven dichtzetten', unit: 'per m²', fallback: 1.25 },
  { key: 'arbeid:lavasteen', label: 'Lavasteen gietvloer', unit: 'per m²', fallback: 15, note: 'in plaats van het legtarief' },
  { key: 'arbeid:microcement', label: 'Microcement / beton ciré', unit: 'per m²', fallback: 26, note: 'in plaats van het legtarief' },
];

export type LaborRates = Record<string, number>;

export const LABOR_FALLBACK: LaborRates = Object.fromEntries(LABOR_CATEGORIES.map((c) => [c.key, c.fallback]));

export const isLaborKey = (key: string): boolean => key.startsWith(LABOR_PREFIX);

/** Een lengte plint is 2,4 m ("67 lengtes a 2,4m", "240cm per lengte"). */
export const PLINTH_LENGTH_M = 2.4;

// "2x trap", "2 trappen": dan staat het aantal trappen er gewoon.
const STAIRS_IN_TEXT_RE = /\b(\d)\s*(?:x\s*trap|trappen)\b/i;

/**
 * Hoeveel trappen bij een verkoop per trede. Treden per offerte vallen in
 * duidelijke groepen: 12–16 (één trap), 26–32 (twee), 39 en 50 (drie of meer).
 */
export function stairsFromSteps(steps: number, desc = ''): number {
  if (steps <= 0) return 0;
  const m = desc.match(STAIRS_IN_TEXT_RE);
  if (m) return Number(m[1]);
  return Math.max(1, Math.round(steps / 14));
}

/**
 * Arbeid in euro's voor een overige-productregel (aantal in de eenheid van de
 * code). 0 als er voor die code geen arbeid is (alleen leveren, verwijderen,
 * vloerverwarming, tapijt met vast bedrag).
 */
export function laborForExtra(code: string, qty: number, desc: string, rates: LaborRates): number {
  const r = (key: string) => rates[key] ?? LABOR_FALLBACK[key] ?? 0;
  switch (code) {
    case 'Plinten':
    case 'Plinten (alleen montage)':
      return r('arbeid:plinten') * qty;
    case 'Plinten (per lengte)':
      return r('arbeid:plinten') * PLINTH_LENGTH_M * qty;
    case 'Traprenovatie PVC dichte trap':
    case 'Traprenovatie PVC open trap':
      return r('arbeid:trap_pvc') * stairsFromSteps(qty, desc);
    case 'Traprenovatie overzettreden':
      return r('arbeid:trap_overzet') * stairsFromSteps(qty, desc);
    case 'Traprenovatie PVC (hele trap)':
      return r('arbeid:trap_pvc') * qty;
    case 'Traprenovatie tapijt':
      return r('arbeid:trap_tapijt') * qty;
    case 'Entreemat':
    case 'Entreemat (per strekkende meter)':
      return r('arbeid:entreemat') * qty;
    case 'Tapijt':
      return r('arbeid:tapijt') * qty;
    case 'Kurkstuc':
      return r('arbeid:kurkstuc') * qty;
    case 'Sleuven dichtzetten':
      return r('arbeid:sleuven') * qty;
    default:
      return 0;
  }
}

/** Codes zonder materiaal: de kostprijs is alleen arbeid, ook als er geen prijs is ingevuld. */
export const LABOR_ONLY_CODES = new Set(['Plinten (alleen montage)']);

/**
 * Eigen legtarief voor een gietvloer, of null voor een gewone vloer. Lavasteen
 * en microcement/Concrada (= beton ciré) worden anders aangebracht dan PVC.
 */
export function pouredFloorLaborKey(desc: string | undefined): string | null {
  if (!desc) return null;
  if (/lavasteen/i.test(desc)) return 'arbeid:lavasteen';
  if (/microcement|concrada|beton\s*cir/i.test(desc)) return 'arbeid:microcement';
  return null;
}
