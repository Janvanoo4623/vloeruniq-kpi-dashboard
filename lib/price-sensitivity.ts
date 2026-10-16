// Prijsgevoeligheid: wat had een iets hogere prijs per m² opgeleverd?
//
// Rekensom: elke extra euro per verkochte m² is een euro extra marge — de
// inkoop en het leggen veranderen er niet door. Dus extra marge = m² × stap.
// De aanname die daaronder ligt is dat je evenveel had verkocht. Of dat zo is,
// weet niemand zeker; daarom staat de winkans van duurdere tegenover goedkopere
// offertes ernaast, uit de eigen historie. Is die bij duurdere offertes niet
// lager, dan is er ruimte.
import { formatProduct } from './format';
import type { QuotationRow } from './types';

const DAY = 86400000;
const r0 = (v: number) => Math.round(v);
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface PriceProduct {
  code: string;
  label: string;
  m2: number;
  pricePerM2: number; // gewogen gemiddelde verkoopprijs
  marginPerM2: number | null; // gewogen, alleen over beprijsde regels
  marginPct: number | null;
}

export interface PriceSensitivity {
  from: string;
  to: string;
  m2Total: number;
  marginTotal: number;
  revenueFloor: number;
  products: PriceProduct[];
  /** Winkans (geaccepteerd / beslist) van offertes onder en boven de mediane prijs per m². */
  winRate: { cheaper: number | null; pricier: number | null; medianPrice: number | null; sample: number };
}

export function priceSensitivity(quotations: QuotationRow[], exclusions: Set<string>, asOf: string): PriceSensitivity {
  const from = new Date(Date.parse(asOf) - 365 * DAY).toISOString().slice(0, 10);
  const per = new Map<string, { m2: number; rev: number; marge: number; margeM2: number; margeRev: number }>();
  let m2Total = 0;
  let marginTotal = 0;
  let revenueFloor = 0;

  for (const q of quotations) {
    if (q.status !== 'accepted' || exclusions.has(q.id) || !q.dateAccepted || q.dateAccepted < from || q.dateAccepted > asOf) continue;
    marginTotal += q.margin ?? 0;
    for (const l of q.lines ?? []) {
      if (l.m2 <= 0) continue;
      const e = per.get(l.code) ?? { m2: 0, rev: 0, marge: 0, margeM2: 0, margeRev: 0 };
      e.m2 += l.m2;
      e.rev += l.revenue;
      if (l.margin != null) {
        e.marge += l.margin;
        e.margeM2 += l.m2;
        e.margeRev += l.revenue;
      }
      per.set(l.code, e);
      m2Total += l.m2;
      revenueFloor += l.revenue;
    }
  }

  const products: PriceProduct[] = [...per.entries()]
    .map(([code, e]) => ({
      code,
      label: formatProduct(code),
      m2: r0(e.m2),
      pricePerM2: r2(e.rev / e.m2),
      marginPerM2: e.margeM2 > 0 ? r2(e.marge / e.margeM2) : null,
      marginPct: e.margeRev > 0 ? r1((e.marge / e.margeRev) * 100) : null,
    }))
    .filter((p) => p.m2 >= 20)
    .sort((a, b) => b.m2 - a.m2);

  // Winkans boven en onder de mediane prijs per m², over de besliste offertes van hetzelfde jaar.
  const beslist = quotations.filter(
    (q) => !exclusions.has(q.id) && q.status !== 'open' && q.dateCreated >= from && q.dateCreated <= asOf && q.totalM2 >= 10 && q.prijsPerM2 > 0,
  );
  const prijzen = beslist.map((q) => q.prijsPerM2).sort((a, b) => a - b);
  const mediaan = prijzen.length > 0 ? prijzen[Math.floor(prijzen.length / 2)] : null;
  const rate = (xs: QuotationRow[]) => (xs.length >= 10 ? r1((xs.filter((q) => q.status === 'accepted').length / xs.length) * 100) : null);

  return {
    from,
    to: asOf,
    m2Total: r0(m2Total),
    marginTotal: r0(marginTotal),
    revenueFloor: r0(revenueFloor),
    products,
    winRate: {
      cheaper: mediaan == null ? null : rate(beslist.filter((q) => q.prijsPerM2 < mediaan)),
      pricier: mediaan == null ? null : rate(beslist.filter((q) => q.prijsPerM2 >= mediaan)),
      medianPrice: mediaan == null ? null : r2(mediaan),
      sample: beslist.length,
    },
  };
}
