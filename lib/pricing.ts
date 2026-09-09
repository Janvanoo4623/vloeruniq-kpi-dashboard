// Date-effective pricing: resolve the purchase price of a product code, or a
// cost setting, as it applied on a given date. This is what makes price edits
// non-retroactive — a quotation always uses the price whose effective_from is
// on/before the quotation's date. See supabase/schema.sql + docs/DATA-MODEL.md.

export interface PriceRow {
  code: string;
  price: number;
  effectiveFrom: string; // YYYY-MM-DD
}

export interface CostRow {
  key: string; // 'labor' | 'primer' | 'glue' | 'leveling'
  value: number;
  effectiveFrom: string; // YYYY-MM-DD
}

/** Latest price for `code` effective on/before `date`; null if none applies yet. */
export function resolvePrice(rows: PriceRow[], code: string, date: string): number | null {
  const c = code.toLowerCase();
  let best: PriceRow | null = null;
  for (const r of rows) {
    if (r.code.toLowerCase() !== c) continue;
    // >= : bij een gelijke ingangsdatum wint de laatst ingevoerde rij. De rijen
    // komen uit db.getPriceRows() op ingangsdatum en daarna op invoegvolgorde.
    if (r.effectiveFrom <= date && (!best || r.effectiveFrom >= best.effectiveFrom)) best = r;
  }
  return best ? best.price : null;
}

/** Latest cost setting for `key` effective on/before `date`, else `fallback`. */
export function resolveCost(
  rows: CostRow[],
  key: string,
  date: string,
  fallback: number,
): number {
  let best: CostRow | null = null;
  for (const r of rows) {
    if (r.key !== key) continue;
    if (r.effectiveFrom <= date && (!best || r.effectiveFrom >= best.effectiveFrom)) best = r;
  }
  return best ? best.value : fallback;
}

/**
 * Build the price config (P-numbers + name matches) as it applied on `date`,
 * from the full effective-dated price rows. Feeds the existing matcher, which
 * stays date-agnostic — we just hand it the right prices for that quotation.
 */
export function priceConfigForDate(
  rows: PriceRow[],
  date: string,
): import('./teamleader/price-map').PriceConfig {
  const codes = new Set(rows.map((r) => r.code));
  const pNumbers: Record<string, number> = {};
  const nameMatches: { name: string; label: string; price: number }[] = [];

  for (const code of codes) {
    const price = resolvePrice(rows, code, date);
    if (price === null) continue;
    if (/^P\d{3}$/i.test(code.trim())) {
      pNumbers[code.trim().toUpperCase()] = price;
    } else {
      nameMatches.push({ name: code.toLowerCase(), label: code, price });
    }
  }
  nameMatches.sort((a, b) => b.name.length - a.name.length);
  return { pNumbers, nameMatches };
}

// ── Kosten per m² op een datum ───────────────────────────────────────────
// Drie bakjes, want een regel draagt niet elke kostenpost. 'primer'/'glue'/
// 'leveling' gelden alleen bij lijmen, 'selfadhesive' alleen bij een
// zelfklevende ondervloer, en die twee sluiten elkaar uit (zie matching.ts).
// Al het overige — arbeid plus eventuele eigen kostenposten — geldt op elke
// gelegde m².
//
// Deze verdeling stond eerst alleen in quotations.ts, waar hij bij het
// synchroniseren wordt toegepast. Sinds de marges ook bij het lézen worden
// herberekend (lib/resolve.ts) moeten beide precies hetzelfde rekenen, dus
// staat de regel hier één keer.
const GLUED_KEYS = new Set(['primer', 'glue', 'leveling']);
const SELF_ADHESIVE_KEY = 'selfadhesive';

export interface CostsPerM2 {
  /** Arbeid + eigen kostenposten: geldt op elke gelegde m². */
  alwaysPerM2: number;
  /** Primer + lijm + egaline: alleen bij lijmen. */
  gluedPerM2: number;
  /** Zelfklevende ondervloer: alleen bij zelfklevend. */
  selfAdhesivePerM2: number;
}

/**
 * Kosten zoals ze op `date` golden. `fallback` levert de ingebouwde tarieven
 * voor sleutels waarvoor nog geen rij bestaat, zodat een nieuwe kostensoort
 * niet stilzwijgend op nul staat.
 */
export function costsForDate(
  rows: CostRow[],
  date: string,
  fallback: Record<string, number>,
): CostsPerM2 {
  const keys = [...new Set([...Object.keys(fallback), ...rows.map((r) => r.key)])];
  let alwaysPerM2 = 0;
  let gluedPerM2 = 0;
  let selfAdhesivePerM2 = 0;
  for (const key of keys) {
    const v = resolveCost(rows, key, date, fallback[key] ?? 0);
    if (key === SELF_ADHESIVE_KEY) selfAdhesivePerM2 = v;
    else if (GLUED_KEYS.has(key)) gluedPerM2 += v;
    else alwaysPerM2 += v;
  }
  return { alwaysPerM2, gluedPerM2, selfAdhesivePerM2 };
}
