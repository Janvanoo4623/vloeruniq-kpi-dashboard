// Overzicht van elke handmatige ingreep op de cijfers: per-offerte correcties
// (afwijkende inkoopprijs, los verkocht) en volledig uitgesloten offertes.
//
// Waarom dit een eigen pagina verdient: een correctie is onzichtbaar zodra je de
// modal sluit, terwijl hij wél doorwerkt in elke KPI. Wie over drie maanden een
// afwijkend margegetal ziet, moet kunnen terugvinden dat daar een mens iets
// heeft ingevuld — en waarom.
import type { QuotationOverride, QuotationRow } from './types';
import type { Exclusion } from './db';

export interface PriceCorrection {
  code: string;
  price: number;
  /** De standaardprijs die hij vervangt, voor zover die op de regel bekend is. */
  basePrice: number | null;
}

export interface ExceptionItem {
  id: string;
  name: string;
  customerName: string;
  status: QuotationRow['status'];
  date: string;
  revenueExVat: number;
  /** Marge mét de correctie erin. */
  margin: number | null;
  marginPct: number | null;
  /** Marge zoals hij zonder enige correctie zou zijn. */
  marginWithout: number | null;
  /** Verschil dat de correctie maakt (positief = correctie verhoogt de marge). */
  effect: number | null;
  noLabor: boolean;
  note: string | null;
  prices: PriceCorrection[];
}

export interface ExceptionsOverview {
  corrections: ExceptionItem[];
  exclusions: (Exclusion & { quotation: QuotationRow | null })[];
  totalEffect: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Bouw het overzicht. `corrected` en `raw` zijn dezelfde offertes mét en zónder
 * overrides, zodat het effect per offerte een echt verschil is en geen schatting.
 */
export function computeExceptions(
  corrected: QuotationRow[],
  raw: QuotationRow[],
  overrides: Record<string, QuotationOverride>,
  exclusionRows: Exclusion[],
): ExceptionsOverview {
  const rawById = new Map(raw.map((q) => [q.id, q]));
  const correctedById = new Map(corrected.map((q) => [q.id, q]));
  const items: ExceptionItem[] = [];
  let totalEffect = 0;

  for (const [id, ov] of Object.entries(overrides)) {
    const hasCorrection = ov.noLabor || Object.keys(ov.prices).length > 0;
    if (!hasCorrection) continue;
    const q = correctedById.get(id);
    if (!q) continue; // offerte bestaat niet (meer)
    const before = rawById.get(id) ?? null;

    // Basisprijs per regel opzoeken, zodat "van X naar Y" te lezen is.
    const baseByCode = new Map<string, number | null>();
    for (const l of before?.lines ?? []) {
      if (!baseByCode.has(l.code.toLowerCase())) {
        baseByCode.set(l.code.toLowerCase(), l.purchasePerM2 ?? null);
      }
    }

    const effect =
      q.margin != null && before?.margin != null ? round2(q.margin - before.margin) : null;
    if (effect != null) totalEffect += effect;

    items.push({
      id,
      name: q.name,
      customerName: q.customerName,
      status: q.status,
      date: q.dateAccepted || q.dateCreated,
      revenueExVat: q.revenueExVat,
      margin: q.margin,
      marginPct: q.marginPct,
      marginWithout: before?.margin ?? null,
      effect,
      noLabor: ov.noLabor,
      note: ov.note ?? null,
      prices: Object.entries(ov.prices).map(([code, price]) => ({
        code,
        price,
        basePrice: baseByCode.get(code) ?? null,
      })),
    });
  }

  items.sort((a, b) => Math.abs(b.effect ?? 0) - Math.abs(a.effect ?? 0));

  return {
    corrections: items,
    exclusions: exclusionRows.map((e) => ({ ...e, quotation: correctedById.get(e.id) ?? null })),
    totalEffect: round2(totalEffect),
  };
}
