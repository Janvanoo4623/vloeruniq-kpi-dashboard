// Per-quotation parsing: floor-line detection, P-number / name price matching,
// and margin computation. Faithful port of the Apps Script's parseQuotation.
// See docs/DATA-MODEL.md.

import { dateOnly, deriveDateParts, round } from './dates';
import { canonicalProduct } from '../format';
import type { PriceConfig } from './price-map';
import type {
  CustomerInfo,
  InstallMode,
  LaborRule,
  QuotationLine,
  QuotationRow,
  QuotationStatus,
} from '../types';
import type { TLQuotationSummary, TLQuotationDetail } from './tl-types';

/**
 * Cost inputs (€/m²) resolved for a quotation's date (date-effective).
 * - alwaysPerM2: labour + any custom extra costs, applied per installed m².
 * - gluedPerM2: primer + glue + leveling, only for glued PVC.
 * - selfAdhesivePerM2: zelfklevende ondervloer, only for self-adhesive PVC.
 * The two underlay rates are mutually exclusive — see INSTALL MODE below.
 */
export interface Costs {
  alwaysPerM2: number;
  gluedPerM2: number;
  selfAdhesivePerM2: number;
}

// Description starts with a floor-product type.
const FLOOR_TYPE_RE = /^(pvc|visgraat|stroken|tegels|hongaarse|weense|klik|vt wonen)/i;
// Finishing / labour lines billed in m² but that are NOT floor surface, e.g.
// "PVC vloer snijden en kitten langs wand". These start with a floor type and so
// slip through FLOOR_TYPE_RE, inflating floor m² (offerte 1003: 254 m² = 159 m²
// vloer P410 + 95 m² snijden/kitten). Identified by "kitten/kitwerk" (a
// wall-finishing action that never appears in a real floor line — floor lines
// say leggen/lijmen/egaliseren/snijverlies). We ONLY drop such a line when it has
// no P-number, so a priced floor line is never excluded even if it mentions kit.
// NB: do NOT match "snij" — every floor line carries "incl. X% snijverlies".
const FINISHING_RE = /kitt/i;
// Description contains a P-number anywhere.
const P_NUMBER_TEST = /P\d{3}/i;
// Extract the first P-number (uppercase) for price lookup.
const P_NUMBER_EXTRACT = /P\d{3}/;

// ── INSTALL MODE ────────────────────────────────────────────────────────────
// A floor line carries at most ONE underlay/adhesive surcharge:
//   glued        primer + lijm + egaline      (€5,10/m² at the current rates)
//   selfadhesive zelfklevende ondervloer      (€5,92/m²)
//   click        nothing — the underlay is built into the plank
//
// Match "zelfklev", NOT "ondervloer". The only self-adhesive line in the whole
// production set spells the word wrong ("Incl. zelfklevende onvervloer, en
// leggen"), so an "ondervloer" rule would MISS it — while hitting the 6 klik-PVC
// lines that say "met geïntegreerde 10db ondervloer", where the underlay sits in
// the plank and must NOT be charged. Wrong in both directions. "zelfklev" occurs
// nowhere else in the data. (Verified against all 315 real line descriptions.)
//
// Deliberately NOT matched: "plakondervloer". It is a synonym for a self-adhesive
// underlay, but its only occurrence is a parenthetical alternative on a line whose
// primary offer is glued ("Incl. egaliseren, lijmen en leggen (Of incl.
// plakondervloer en leggen ipv egaliseren)") — matching it would flip that line to
// the wrong mode. Revisit if it ever appears as a line's actual offer.
const SELF_ADHESIVE_RE = /zelfklev/i;
const GLUED_RE = /lijm/i;

// ── LEGSERVICE (labour) ─────────────────────────────────────────────────────
// A floor sold without installation carries no labour. The exclusion MUST be
// tested before the word "leggen" itself: "excl. leggen klik pvc" contains
// "leggen", so a plain includes() reads it as installed — exactly backwards.
//
// Derived from every distinct "leggen/leveren" phrasing in the 315 stored line
// descriptions — all 28 of them, not a guess at what the text might say:
//   included  "Incl. egaliseren, lijmen en leggen" and 14 further Incl.-variants,
//             plus "10% extra voor het schuin leggen" and "incl. montage"
//   excluded  "Alleen leveren(vloer)", "excl./exclusief leggen",
//             "Ex/Exclusief legservice"   <- note the bare "Ex", no "cl"
//   unknown   the line says nothing either way
// The silent ones keep their labour but set laborRule 'unknown', so they surface
// for review instead of being guessed either way. Guessing from a pattern that
// was never checked against real text is what zeroed all floor m² once before.
// "ex" is listed separately from "excl": one offerte reads "Ex legservice" and a
// pattern built on "excl" alone silently charged it €17/m². Requiring leg(gen|
// service) right after keeps it safe — "ex. btw" can never match.
//
// "leggen" wordt ook als "legge" geschreven ("Incl. egaliseren, lijmen en legge").
// Vandaar de optionele slot-n. Dit is de derde typefout op rij die een regel deed
// missen — na "onvervloer" en "Ex legservice" — dus de patronen zijn bewust ruim
// op spelling en streng op betekenis, niet andersom.
const NO_LABOR_RE =
  /\b(?:excl\.?|exclusief|ex\.?|zonder)\s*(?:het\s+)?leg(?:gen?|service)?\b|\balleen\s+(?:leveren|levering)\b/i;
const HAS_LABOR_RE = /\bleg(?:gen?|service)\b|\bgelegd\b|\bmont(?:age|eren)\b/i;

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
  // Geweigerd en verlopen zijn allebei een beslismoment: de offerte is niet meer
  // in de running en updated_at is de datum waarop dat gebeurde.
  const isDecidedLost = status === 'refused' || status === 'expired';
  const createdAt = dateOnly(summary.created_at);
  const updatedAt = dateOnly(summary.updated_at);
  const dateAccepted = isAccepted ? updatedAt : '';

  // Relevant date drives month/quarter/year (lost quotes use their updated date).
  let relevantDate = createdAt;
  if (isAccepted && dateAccepted) relevantDate = dateAccepted;
  if (isDecidedLost && updatedAt) relevantDate = updatedAt;
  const { month, quarter, year } = deriveDateParts(relevantDate);

  let totalM2 = 0;
  let omzetVloer = 0;
  let totalCost = 0; // material only (purchase + underlay)
  let laborCost = 0; // accumulated per line — labour is no longer uniform
  let m2WithMatch = 0;
  let hasMatch = false;
  let needsReview = false;
  const products: string[] = []; // matched floor products (P-numbers / names), distinct
  const lines: QuotationLine[] = []; // per-product line stats for top-products aggregation

  for (const group of detail?.grouped_lines ?? []) {
    for (const item of group.line_items ?? []) {
      const rawDesc = item.description ?? '';
      const desc = rawDesc.toLowerCase();
      const descTrimmed = rawDesc.trim();

      if (desc.includes('trap')) continue; // exclude traprenovatie (stair renovation)
      // "kitten langs wand" finishing line — but never drop a priced floor line.
      if (FINISHING_RE.test(desc) && !P_NUMBER_TEST.test(descTrimmed)) continue;

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

      // Install mode → underlay surcharge. Self-adhesive is checked first so a
      // line that mentions both can never be charged twice.
      const installMode: InstallMode = SELF_ADHESIVE_RE.test(desc)
        ? 'selfadhesive'
        : GLUED_RE.test(desc)
          ? 'glued'
          : 'click';
      const underlayPerM2 =
        installMode === 'selfadhesive'
          ? costs.selfAdhesivePerM2
          : installMode === 'glued'
            ? costs.gluedPerM2
            : 0;

      // Legservice → labour. Exclusion is tested before the word "leggen" itself.
      const laborRule: LaborRule = NO_LABOR_RE.test(desc)
        ? 'excluded'
        : HAS_LABOR_RE.test(desc)
          ? 'included'
          : 'unknown';
      const laborPerM2 = laborRule === 'excluded' ? 0 : costs.alwaysPerM2;
      if (laborRule === 'unknown') needsReview = true;

      let lineMargin: number | null = null;
      if (matchedPrice !== null) {
        const materialCostPerM2 = matchedPrice + underlayPerM2;
        totalCost += materialCostPerM2 * quantity;
        laborCost += laborPerM2 * quantity;
        m2WithMatch += quantity;
        hasMatch = true;
        lineMargin = lineRevenue - (materialCostPerM2 + laborPerM2) * quantity;
      }

      if (product) {
        lines.push({
          code: product,
          revenue: lineRevenue,
          m2: quantity,
          margin: lineMargin,
          desc: descTrimmed,
          // Cost components for instant per-quotation override recompute.
          purchasePerM2: matchedPrice ?? undefined,
          underlayPerM2,
          laborPerM2,
          installMode,
          laborRule,
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
    needsReview,
    products,
    lines,
  };

  return row;
}
