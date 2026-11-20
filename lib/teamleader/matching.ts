// Per-quotation parsing: floor-line detection, P-number / name price matching,
// and margin computation. Faithful port of the Apps Script's parseQuotation.
// See docs/DATA-MODEL.md.

import { dateOnly, deriveDateParts, round } from './dates';
import { canonicalProduct } from '../format';
import { classifyExtra, isExtraCode } from '../extras';
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
// "Click PVC …" is dezelfde klikvloer als "Klik PVC …" in Engelse spelling. Zonder
// P-nummer viel zo'n regel buiten m² en marge (2026-11-19, gevonden bij de
// vergelijking met Jans planning-Sheet: 9 geaccepteerde regels, ±400 m², ±€14k).
const FLOOR_TYPE_RE = /^(pvc|visgraat|stroken|tegels|hongaarse|weense|klik|click|vt wonen)/i;
// Finishing / labour lines billed in m² but that are NOT floor surface, e.g.
// "PVC vloer snijden en kitten langs wand". These start with a floor type and so
// slip through FLOOR_TYPE_RE, inflating floor m² (offerte 1003: 254 m² = 159 m²
// vloer P410 + 95 m² snijden/kitten). Identified by "kitten/kitwerk" (a
// wall-finishing action that never appears in a real floor line — floor lines
// say leggen/lijmen/egaliseren/snijverlies). We ONLY drop such a line when it has
// no P-number, so a priced floor line is never excluded even if it mentions kit.
// NB: do NOT match "snij" — every floor line carries "incl. X% snijverlies".
const FINISHING_RE = /kitt/i;
// Gietvloeren (lavasteen, microcement) beginnen niet met een vloertype maar met
// een merk ("Concrada Microcement 2k gietvloer ...") en zijn dus nooit als vloer
// herkend. Gecheckt op alle 432 geaccepteerde/open offertes (2026-11-05): het
// woord "gietvloer" staat op precies de vier gietvloerregels en nergens anders.
// "KorqStuc" en "kurkstuc incl. aanbrengen" zijn wandafwerking en blijven erbuiten.
// Een regel die een gietvloer verwijdert is geen gietvloer.
const POURED_FLOOR_RE = /gietvloer/i;
const REMOVAL_RE = /verwijder|afvoer|slopen/i;
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
//
// "Zelf leggen" (de klant legt zelf) bevat het woord "leggen" en telde daardoor als
// mét legservice; "Exclusive installation" is de Engelse variant van excl. leggen
// (2026-11-19, offerte met 42 m² "Klik PVC | Zelf leggen" kreeg €714 legkosten).
const NO_LABOR_RE =
  /\b(?:excl\.?|exclusief|ex\.?|zonder)\s*(?:het\s+)?leg(?:gen?|service)?\b|\balleen\s+(?:leveren|levering)\b|\bzelf\s+(?:te\s+)?leg(?:gen?)?\b|\bexclusive\s+installation\b/i;
// "aanbrengen" is hoe een gietvloer gelegd wordt ("Lavasteen Gietvloer | Incl. aanbrengen").
const HAS_LABOR_RE = /\bleg(?:gen?|service)\b|\bgelegd\b|\bmont(?:age|eren)\b|\baanbreng(?:en)?\b/i;

/**
 * Is deze regel een vloer (en geen overig product, trapmateriaal of afwerking)?
 * Overige producten worden vóór deze test herkend met `classifyExtra`.
 * Gedeeld met lib/planning-sheet.ts, zodat de planning dezelfde regels volgt.
 */
export function isFloorLine(rawDesc: string): boolean {
  const descTrimmed = rawDesc.trim();
  const desc = rawDesc.toLowerCase();
  if (desc.includes('trap')) return false; // overige trapregels (profielsets, plateau) blijven erbuiten
  // "kitten langs wand" finishing line — but never drop a priced floor line.
  if (FINISHING_RE.test(desc) && !P_NUMBER_TEST.test(descTrimmed)) return false;
  return (
    P_NUMBER_TEST.test(descTrimmed) ||
    FLOOR_TYPE_RE.test(descTrimmed) ||
    (POURED_FLOOR_RE.test(descTrimmed) && !REMOVAL_RE.test(descTrimmed))
  );
}

/** Legservice: uitsluiting wordt vóór het woord "leggen" zelf getest. */
export function laborRuleOf(rawDesc: string): LaborRule {
  const desc = rawDesc.toLowerCase();
  return NO_LABOR_RE.test(desc) ? 'excluded' : HAS_LABOR_RE.test(desc) ? 'included' : 'unknown';
}

/**
 * Naam afleiden uit de omschrijving als er géén P-nummer is en geen naam uit de
 * prijslijst matcht. Zonder dit verdwijnt de regel volledig: hij telt wél mee in
 * m² en omzet, maar duikt nergens op als "vloer zonder inkoopprijs" — want die
 * lijst keek alleen naar regels die al een product hádden.
 *
 * Gemeten op de 60 grootste onherkende offertes: 99 regels, 8.592 m² en
 * EUR 423.777 aan omzet zaten zo in een blinde vlek. De naam is het stuk vóór de
 * eerste pipe ("PVC Visgraat Volano Light Oak | Incl. 10% snijverlies | ..."),
 * want daarachter staat consequent de uitvoering, niet het product.
 */
function deriveProductName(rawDesc: string): string | null {
  const first = rawDesc.split('|')[0].trim().replace(/\s+/g, ' ');
  if (first.length < 3 || first.length > 80) return null;
  // Een losse "PVC" of "Stroken" is geen product; er moet iets onderscheidends staan.
  if (/^(pvc|visgraat|stroken|tegels|klik)$/i.test(first)) return null;
  return first;
}

/**
 * Korting naar rato (2026-11-18). Vloeruniq zet korting als negatieve regel op
 * de offerte ("Regio korting", "Korting Rijssen", "korting plint"); het
 * kortingsveld van Teamleader zelf (`discounts`) is in de praktijk leeg. Tot nu
 * toe sloeg de app die regels over en rekende hij met de regelbedragen vóór
 * korting: bij 237 van de 421 geaccepteerde offertes lag de som van de vloer- en
 * overige regels boven het offertetotaal, samen EUR 88.800 te veel omzet in de marge.
 *
 * Factor = offertetotaal ex btw ÷ som van alle positieve regels. Dat vangt een
 * negatieve regel én een eventuele korting op offerteniveau, en verdeelt hem
 * over álle regels — ook over wat de app niet herkent (stucwerk), zodat de vloer
 * niet de korting van een ander onderdeel draagt. Nooit boven 1, en zonder
 * totaal of positieve regels 1: dan weten we het niet en laten we het zoals het was.
 */
export function discountFactor(
  detail: { grouped_lines?: { line_items?: { total?: { tax_exclusive?: { amount?: number } } }[] }[] } | null,
  totalExcl: number,
): number {
  let positief = 0;
  for (const g of detail?.grouped_lines ?? []) {
    for (const item of g.line_items ?? []) {
      const a = item.total?.tax_exclusive?.amount ?? 0;
      if (a > 0) positief += a;
    }
  }
  if (!(totalExcl > 0) || !(positief > 0)) return 1;
  return Math.min(1, totalExcl / positief);
}

type DetailWithLines = {
  grouped_lines?: {
    line_items?: { description?: string; quantity?: number; total?: { tax_exclusive?: { amount?: number } } }[];
  }[];
} | null;

/**
 * Korting over de VLOER (Jan, 2026-11-20: "In principe is de korting niet over
 * de plinten maar over de vloer"). Vervangt de verdeling over alle regels van
 * 2026-11-18 voor de regels die we opslaan. Bijna alle kortingsregels zijn
 * algemeen ("Regiokorting", "Korting", "Korting >100m2"); een productkorting als
 * "korting plint" kwam in de dump niet voor.
 *
 * Korting = som van de positieve regels − offertetotaal. Die gaat in zijn geheel
 * van de vloerregels af; overige producten houden hun bedrag. Is er geen vloer,
 * of is de korting groter dan het vloerbedrag (alternatieven, rare offertes),
 * dan naar rato over alles, zoals voorheen. Het offertetotaal en de marge per
 * offerte veranderen niet — alleen hoe de omzet over vloer en plinten verdeeld is.
 */
export function discountFactors(detail: DetailWithLines, totalExcl: number): { floor: number; other: number } {
  let positief = 0;
  let vloer = 0;
  for (const g of detail?.grouped_lines ?? []) {
    for (const item of g.line_items ?? []) {
      const a = item.total?.tax_exclusive?.amount ?? 0;
      if (!(a > 0)) continue;
      positief += a;
      const d = item.description ?? '';
      if (!classifyExtra(d, item.quantity ?? 0, a) && isFloorLine(d)) vloer += a;
    }
  }
  if (!(totalExcl > 0) || !(positief > 0)) return { floor: 1, other: 1 };
  const korting = positief - totalExcl;
  if (korting <= 0) return { floor: 1, other: 1 };
  if (vloer > korting) return { floor: (vloer - korting) / vloer, other: 1 };
  const f = totalExcl / positief;
  return { floor: f, other: f };
}

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
  // De datum waarop de offerte uit de running ging: geaccepteerd, geweigerd of
  // verlopen. Voor alle drie is dat updated_at.
  //
  // Dit MOET voor alle drie gevuld zijn, want de sync filtert ze ook alle drie op
  // updated_at. Vulden we hem alleen voor 'geaccepteerd', dan viel een verlopen
  // offerte terug op zijn aanmaakdatum en belandde een offerte uit januari 2025
  // die in juni 2026 verliep in week 2025-W1 — binnen een venster van 90 dagen.
  const dateAccepted = isAccepted || isDecidedLost ? updatedAt : '';

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
  const factors = discountFactors(detail as DetailWithLines, totalExcl);
  /** Regelbedrag na korting, plus het bedrag ervóór als er korting was. */
  const netto = (bruto: number, soort: 'floor' | 'other') => {
    const factor = factors[soort];
    return factor < 1 ? { revenue: round(bruto * factor), revenueBeforeDiscount: bruto } : { revenue: bruto };
  };

  for (const group of detail?.grouped_lines ?? []) {
    for (const item of group.line_items ?? []) {
      const rawDesc = item.description ?? '';
      const desc = rawDesc.toLowerCase();
      const descTrimmed = rawDesc.trim();
      const brutoRegel = item.total?.tax_exclusive?.amount ?? 0;

      // Een negatieve regel is korting ("korting plint", "gratis entreemat"),
      // geen product: hij zit al in de factor hierboven.
      if (brutoRegel < 0) continue;

      // Overige producten (trap, plint, tapijt, entreemat, verwijderen) eerst:
      // "PVC vloer verwijderen" begint met een vloertype maar is geen vloer.
      // Ze tellen niet mee in m² of vloeromzet; de marge rekent lib/resolve.ts.
      // Herkend op het bedrag vóór korting: de prijsgrenzen in classifyExtra
      // zijn op lijstprijzen gemeten.
      const extra = brutoRegel !== 0 ? classifyExtra(rawDesc, item.quantity ?? 0, brutoRegel) : null;
      const { revenue: extraRevenue, revenueBeforeDiscount: extraBruto } = netto(brutoRegel, 'other');
      if (extra) {
        const qty = extra.quantity ?? item.quantity ?? 0;
        const cpu = priceConfig.nameMatches.find((nm) => nm.name === extra.code.toLowerCase())?.price;
        lines.push({
          code: extra.code,
          kind: 'extra',
          unit: extra.unit,
          qty,
          revenue: extraRevenue,
          ...(extraBruto != null ? { revenueBeforeDiscount: extraBruto } : {}),
          m2: 0,
          margin: cpu != null ? round(extraRevenue - cpu * qty) : null,
          desc: descTrimmed,
          ...(cpu != null ? { costPerUnit: cpu } : {}),
        });
        continue;
      }
      if (!isFloorLine(rawDesc)) continue;

      const quantity = item.quantity ?? 0;
      const { revenue: lineRevenue, revenueBeforeDiscount } = netto(brutoRegel, 'floor');
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
          // Een kostprijs per trede of per meter plint hoort nooit op een vloer.
          if (isExtraCode(nm.name)) continue;
          if (desc.includes(nm.name)) {
            matchedPrice = nm.price;
            if (!product) product = nm.label;
            break;
          }
        }
      }

      // Niets herkend? Dan de naam uit de omschrijving halen, zodat de regel
      // zichtbaar wordt als "vloer zonder inkoopprijs" in plaats van te verdwijnen.
      let derivedCode = false;
      if (!product) {
        const afgeleid = deriveProductName(descTrimmed);
        if (afgeleid) {
          product = afgeleid;
          derivedCode = true;
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
      const laborRule = laborRuleOf(rawDesc);
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
          ...(revenueBeforeDiscount != null ? { revenueBeforeDiscount } : {}),
          m2: quantity,
          margin: lineMargin,
          desc: descTrimmed,
          // Cost components for instant per-quotation override recompute.
          purchasePerM2: matchedPrice ?? undefined,
          underlayPerM2,
          laborPerM2,
          installMode,
          laborRule,
          // true = naam uit de omschrijving afgeleid, dus zeker nog geen prijs.
          ...(derivedCode ? { derivedCode: true } : {}),
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
