// Detect floor product codes (P-numbers) that appear in quotations but have no
// purchase price configured. These surface as line items with margin === null
// (a P-number was recognised, but no price matched — see teamleader/matching.ts).
import type { QuotationRow } from './types';

export interface MissingPrice {
  code: string;
  quotationCount: number; // # distinct quotations containing this unpriced code
  m2: number; // total m² affected
  revenue: number; // floor revenue affected (ex VAT)
}

/**
 * Aggregate unpriced floor codes across quotations, biggest revenue impact first.
 * `pricedCodes` (lowercased) are excluded — already priced, possibly pending a sync.
 */
export function computeMissingPrices(
  quotations: QuotationRow[],
  pricedCodes: Set<string> = new Set(),
): MissingPrice[] {
  const byCode = new Map<string, MissingPrice & { _ids: Set<string> }>();

  for (const q of quotations) {
    for (const l of q.lines ?? []) {
      if (l.margin !== null) continue; // priced line
      if (pricedCodes.has(l.code.toLowerCase())) continue;
      let mp = byCode.get(l.code);
      if (!mp) {
        mp = { code: l.code, quotationCount: 0, m2: 0, revenue: 0, _ids: new Set() };
        byCode.set(l.code, mp);
      }
      mp.m2 += l.m2;
      mp.revenue += l.revenue;
      if (!mp._ids.has(q.id)) {
        mp._ids.add(q.id);
        mp.quotationCount += 1;
      }
    }
  }

  return [...byCode.values()]
    .map((mp) => ({
      code: mp.code,
      quotationCount: mp.quotationCount,
      m2: Math.round(mp.m2 * 10) / 10,
      revenue: Math.round(mp.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}
