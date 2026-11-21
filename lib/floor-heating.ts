// Vloerverwarming: inkoop bij de installateur (Vloerverwarming Oost-Nederland,
// "Installateurs Fresen 2026", foto van Jan 2026-11-21). De installateur freest
// en legt de vloerverwarming; Vloeruniq zet daarna de sleuven dicht (eigen
// product "Sleuven dichtzetten").
//
// De inkoop is een STAFFEL per aantal groepen (één groep ≈ 10 m²), geen prijs
// per groep: 5 groepen €1.640, 6 groepen €1.760, met onregelmatige stappen. Elke
// staffel staat als eigen code in product_prices ("Vloerverwarming 5 groepen"),
// zodat Jan hem in Instellingen kan wijzigen en een nieuwe lijst een
// ingangsdatum krijgt. De lijst van 2026 geldt vanaf 2026-01-01; daarvoor
// verkochten ze 5 groepen vaak onder deze inkoop, dus de lijst van 2025 was
// lager (bij Jan opgevraagd).
//
// Meerprijs per groep bij frezen door tegels of beton, herkend in de regeltekst
// ("Door tegelvloer frezen"). Radiator afkoppelen, optimizer en by-pass staan
// niet in de offerteteksten en blijven erbuiten.

export const FLOOR_HEATING_CODE = 'Vloerverwarming';
export const FLOOR_HEATING_MAX_GROUPS = 13;

export const floorHeatingTierCode = (groups: number): string =>
  `Vloerverwarming ${groups} ${groups === 1 ? 'groep' : 'groepen'}`;

export const FLOOR_HEATING_TILE_CODE = 'Vloerverwarming meerprijs tegelvloer';
export const FLOOR_HEATING_CONCRETE_CODE = 'Vloerverwarming meerprijs betonvloer';

/** Prijslijst 2026, ex btw, totaal per klus. */
export const FLOOR_HEATING_LIST_2026: Record<number, number> = {
  1: 1180, 2: 1310, 3: 1420, 4: 1515, 5: 1640, 6: 1760, 7: 1870,
  8: 2025, 9: 2150, 10: 2400, 11: 2425, 12: 2560, 13: 2795,
};
export const FLOOR_HEATING_SURCHARGE_2026 = { tile: 200, concrete: 400 };

/** Alle prijscodes van vloerverwarming, in de volgorde van Instellingen. */
export const FLOOR_HEATING_PRICE_CODES: { code: string; label: string }[] = [
  ...Array.from({ length: FLOOR_HEATING_MAX_GROUPS }, (_, i) => ({
    code: floorHeatingTierCode(i + 1),
    label: 'per klus',
  })),
  { code: FLOOR_HEATING_TILE_CODE, label: 'per groep' },
  { code: FLOOR_HEATING_CONCRETE_CODE, label: 'per groep' },
];

const TILE_RE = /tegel/i;
const CONCRETE_RE = /beton(?!\s*cir)/i;

/**
 * Inkoop voor een regel vloerverwarming, of null als een benodigde prijs
 * ontbreekt (dan geen marge). `price(code)` geeft de prijs op de offertedatum.
 * `baseGroups` is voor een factuurregel die groepen BOVENOP de offerte telt:
 * dan kost het alleen het verschil tussen de twee staffels.
 */
export function floorHeatingCost(
  groups: number,
  desc: string,
  price: (code: string) => number | null,
  baseGroups = 0,
): number | null {
  if (groups <= 0) return null;
  const tier = (n: number): number | null => (n <= 0 ? 0 : price(floorHeatingTierCode(n)));
  const totaal = tier(baseGroups + groups);
  const basis = tier(baseGroups);
  if (totaal == null || basis == null) return null;
  let cost = totaal - basis;
  if (TILE_RE.test(desc)) {
    const p = price(FLOOR_HEATING_TILE_CODE);
    if (p == null) return null;
    cost += p * groups;
  }
  if (CONCRETE_RE.test(desc)) {
    const p = price(FLOOR_HEATING_CONCRETE_CODE);
    if (p == null) return null;
    cost += p * groups;
  }
  return cost;
}
