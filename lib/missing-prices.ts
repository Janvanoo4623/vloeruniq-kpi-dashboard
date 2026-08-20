// Detect floor product codes (P-numbers) that appear in quotations but have no
// purchase price configured. These surface as line items with margin === null
// (a P-number was recognised, but no price matched — see teamleader/matching.ts).
import type { QuotationRow } from './types';

export interface MissingPrice {
  code: string;
  quotationCount: number; // # distinct quotations containing this unpriced code
  m2: number; // total m² affected
  revenue: number; // floor revenue affected (ex VAT)
  /**
   * De code is uit de omschrijving afgeleid, niet uit een P-nummer of een
   * naam uit de prijslijst. Die vragen om een andere actie: bij een P-nummer
   * vul je alleen de prijs in, bij een afgeleide naam bepaal je eerst of het
   * een eigen product is of een schrijfwijze van iets dat al bestaat.
   */
  derived: boolean;
}

/** Een offerte met omzet waarin we geen enkele vloerregel herkennen. */
export interface UnmatchedQuotation {
  id: string;
  name: string;
  customerName: string;
  status: QuotationRow['status'];
  date: string;
  revenueExVat: number;
  totalM2: number;
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
        mp = {
          code: l.code,
          quotationCount: 0,
          m2: 0,
          revenue: 0,
          derived: Boolean(l.derivedCode),
          _ids: new Set(),
        };
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
      derived: mp.derived,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

/**
 * Offertes met omzet waarin geen énkele vloerregel wordt herkend. Meestal een
 * project dat per ruimte is uitgesplitst ("Ruimte 1.18 Kantine / Bar:"): de m²
 * en de omzet staan er wel, maar de regel noemt geen vloer, en de groepskop
 * evenmin — die zegt "BEGANE GROND" of "1e VERDIEPING".
 *
 * We tellen die m² bewust NIET automatisch mee. In dezelfde offertes staan
 * regels als "Verwijderen en afvoeren tapijt 370" met net zo goed m², en die
 * zou een ruimere regel meesleuren. Liever zichtbaar onbekend dan stilzwijgend
 * verkeerd — dat is precies de les van de matchingfouten die we vandaag vonden.
 */
export function computeUnmatchedQuotations(quotations: QuotationRow[]): UnmatchedQuotation[] {
  return quotations
    .filter((q) => (q.lines ?? []).length === 0 && q.revenueExVat > 0)
    .map((q) => ({
      id: q.id,
      name: q.name,
      customerName: q.customerName,
      status: q.status,
      date: q.dateAccepted || q.dateCreated,
      revenueExVat: q.revenueExVat,
      totalM2: q.totalM2,
    }))
    .sort((a, b) => b.revenueExVat - a.revenueExVat);
}
