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
    if (r.effectiveFrom <= date && (!best || r.effectiveFrom > best.effectiveFrom)) best = r;
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
    if (r.effectiveFrom <= date && (!best || r.effectiveFrom > best.effectiveFrom)) best = r;
  }
  return best ? best.value : fallback;
}

/**
 * Build the price config (P-numbers + name matches) as it applied on `date`,
 * from the full effective-dated price rows. Feeds the existing matcher, which
 * stays date-agnostic — we just hand it the right prices for that quotation.
 */
export interface DatedPriceConfig {
  pNumbers: Record<string, number>;
  nameMatches: { name: string; label: string; price: number }[];
}

export function priceConfigForDate(rows: PriceRow[], date: string): DatedPriceConfig {
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
