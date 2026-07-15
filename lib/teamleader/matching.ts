// Per-quotation parsing: floor-line detection, P-number / name price matching,
// and margin computation. Faithful port of the Apps Script's parseQuotation.
// See docs/DATA-MODEL.md.

import { dateOnly, deriveDateParts, round } from './dates';
import { canonicalProduct } from '../format';
import type { PriceConfig } from './price-map';
import type { CustomerInfo, QuotationLine, QuotationRow, QuotationStatus } from '../types';
import type { TLQuotationSummary, TLQuotationDetail } from './tl-types';

/**
 * Cost inputs (€/m²) resolved for a quotation's date (date-effective).
 * - alwaysPerM2: applied to every matched floor m² (labor + any custom extra costs).
 * - gluedPerM2: applied only to glued PVC (primer + glue + leveling).
 */
export interface Costs {
  alwaysPerM2: number;
  gluedPerM2: number;
}

// Description starts with a floor-product type.
const FLOOR_TYPE_RE = /^(pvc|visgraat|stroken|tegels|hongaarse|weense|klik|vt wonen)/i;
// Finishing / labour lines that are billed in m² but are NOT actual floor
// surface (e.g. "snijden en kitten langs wand"). These otherwise slip through
// FLOOR_TYPE_RE (they start with the floor type) and inflate the floor m²,
// diluting price/m² and coverage. See feedback 2026-07-13 (offerte 1003:
// 254 m² = 159 m² vloer + 95 m² snijden/kitten). Extend as new cases surface.
const FINISHING_RE = /snij|kitt/i;
// Description contains a P-number anywhere.
const P_NUMBER_TEST = /P\d{3}/i;
// Extract the first P-number (uppercase) for price lookup.
const P_NUMBER_EXTRACT = /P\d{3}/;

export function parseQuotation(
  summary: TLQuotationSummary,
  detail: TLQuotationDetail | null,
  customerLookup: Record<string, CustomerInfo>,
  priceConfig: PriceConfig,
  costs: Costs,
): QuotationRow {
  const status = summary.status as QuotationStatus;
  const totalExcl = summary.total?.tax_exclusive?.amount ?? 0;
  const totalIncl = summary.total?.tax_inclusive?.amount ?? 0;
  const dealId = summary.deal?.id ?? '';
  const customer = customerLookup[dealId];
  const customerName = customer?.name ?? '';
  const city = customer?.city ?? '';
  const postalCode = customer?.postalCode ?? '';

  const isAccepted = status === 'accepted';
  const isRefused = status === 'refused';
  const createdAt = dateOnly(summary.created_at);
  const updatedAt = dateOnly(summary.updated_at);
  const dateAccepted = isAccepted ? updatedAt : '';

  // Relevant date drives month/quarter/year (refused uses its updated date).
  let relevantDate = createdAt;
  if (isAccepted && dateAccepted) relevantDate = dateAccepted;
  if (isRefused && updatedAt) relevantDate = updatedAt;
  const { month, quarter, year } = deriveDateParts(relevantDate);

  let totalM2 = 0;
  let omzetVloer = 0;
  let totalCost = 0;
  let m2WithMatch = 0;
  let hasMatch = false;
  const products: string[] = []; // matched floor products (P-numbers / names), distinct
  const lines: QuotationLine[] = []; // per-product line stats for top-products aggregation

  for (const group of detail?.grouped_lines ?? []) {
    for (const item of group.line_items ?? []) {
      const rawDesc = item.description ?? '';
      const desc = rawDesc.toLowerCase();
      const descTrimmed = rawDesc.trim();

      if (desc.includes('trap')) continue; // exclude traprenovatie (stair renovation)
      if (FINISHING_RE.test(desc)) continue; // snijden/kitten etc. — labour, not floor m²

      const isFloor = P_NUMBER_TEST.test(descTrimmed) || FLOOR_TYPE_RE.test(descTrimmed);
      if (!isFloor) continue;

      const quantity = item.quantity ?? 0;
      const lineRevenue = item.total?.tax_exclusive?.amount ?? 0;
      totalM2 += quantity;
      omzetVloer += lineRevenue;

      // Find a purchase price: P-number first, then name match (longest-first).
      // Also capture a product reference for display (P-number or product name).
      let matchedPrice: number | null = null;
      let product: string | null = null;

      const pMatch = rawDesc.toUpperCase().match(P_NUMBER_EXTRACT);
      if (pMatch) {
        product = pMatch[0]; // the P-number is the product, even if it has no configured price
        if (priceConfig.pNumbers[pMatch[0]] !== undefined) {
          matchedPrice = priceConfig.pNumbers[pMatch[0]];
        }
      }
      if (matchedPrice === null) {
        for (const nm of priceConfig.nameMatches) {
          if (desc.includes(nm.name)) {
            matchedPrice = nm.price;
            if (!product) product = nm.label;
            break;
          }
        }
      }

      if (product) product = canonicalProduct(product);
      if (product && !products.includes(product)) products.push(product);

      let lineMargin: number | null = null;
      if (matchedPrice !== null) {
        let materialCostPerM2 = matchedPrice;
        if (desc.includes('lijmen')) {
          // Glued PVC: purchase + primer + glue + leveling.
          materialCostPerM2 += costs.gluedPerM2;
        }
        // Click PVC: material is just the purchase price.
        const lineCost = materialCostPerM2 * quantity + costs.alwaysPerM2 * quantity;
        totalCost += materialCostPerM2 * quantity;
        m2WithMatch += quantity;
        hasMatch = true;
        lineMargin = lineRevenue - lineCost;
      }

      if (product) {
        lines.push({
          code: product,
          revenue: lineRevenue,
          m2: quantity,
          margin: lineMargin,
          desc: descTrimmed,
        });
      }
    }
  }

  let cost: number | null = null;
  let margin: number | null = null;
  let marginPct: number | null = null;
  let matchCoverage: number | null = null;
  let verified = false;

  if (hasMatch && m2WithMatch > 0) {
    const laborCost = costs.alwaysPerM2 * m2WithMatch;
    const finalCost = totalCost + laborCost;
    cost = round(finalCost);
    // Margin is measured against floor revenue only.
    margin = round(omzetVloer - finalCost);
    marginPct = omzetVloer > 0 ? round((margin / omzetVloer) * 100, 1) : null;
    if (totalM2 > 0) {
      matchCoverage = round((m2WithMatch / totalM2) * 100, 1);
      if (matchCoverage === 100 && margin !== null) verified = true;
    }
  }

  const prijsPerM2 = totalM2 > 0 ? omzetVloer / totalM2 : 0;

  const row: QuotationRow = {
    id: summary.id,
    name: summary.name ?? '',
    dealId,
    customerName,
    city,
    postalCode,
    status,
    dateCreated: createdAt,
    dateAccepted,
    month,
    quarter,
    year,
    revenueExVat: totalExcl,
    revenueInclVat: totalIncl,
    omzetVloer: round(omzetVloer),
    totalM2,
    prijsPerM2: round(prijsPerM2),
    cost,
    margin,
    marginPct,
    matchCoverage,
    verified,
    products,
    lines,
  };

  return row;
}
