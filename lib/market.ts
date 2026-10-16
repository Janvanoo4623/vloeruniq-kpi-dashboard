// De markt om Vloeruniq heen, uit open data van het CBS (geen sleutel nodig).
//
//  - Consumentenvertrouwen, tabel 83693NED, maandelijks: vooral de vraag of
//    het "een gunstige tijd is voor grote aankopen". Een nieuwe vloer ís een
//    grote aankoop; zakt die reeks, dan merk je dat een paar maanden later aan
//    het aantal offertes dat wordt getekend.
//  - Invoerprijzen, tabel 85770NED (index 2021=100), maandelijks, voor de
//    producten die Vloeruniq inkoopt: kunststof vloerbedekking (PVC), panelen
//    voor parketvloeren en lijm. Invoerprijzen omdat vrijwel alle PVC uit het
//    buitenland komt. Stijgt de index, dan komt een prijsverhoging van de
//    leverancier eraan — vóórdat hij in de marge zichtbaar wordt.
//
// Geverifieerd 2026-10-16: consumentenvertrouwen t/m september 2026,
// invoerprijzen t/m augustus 2026. Een dag cache; faalt zacht (lege reeks).
import type { QuotationRow } from './types';

const VERTROUWEN = 'https://opendata.cbs.nl/ODataApi/OData/83693NED/TypedDataSet';
const PPI = 'https://opendata.cbs.nl/ODataApi/OData/85770NED/TypedDataSet';
const INVOERPRIJZEN = 'A044077';

export const PRICE_SERIES = [
  { key: 'pvc', code: 'A014429', label: 'Kunststof vloerbedekking (PVC)' },
  { key: 'parket', code: 'A013436', label: 'Panelen voor parketvloeren' },
  { key: 'lijm', code: 'A014159', label: 'Lijm' },
] as const;
export type PriceKey = (typeof PRICE_SERIES)[number]['key'];

export interface ConfidencePoint {
  month: string; // YYYY-MM
  confidence: number | null; // consumentenvertrouwen
  bigPurchases: number | null; // gunstige tijd voor grote aankopen
}

export interface PricePoint {
  month: string;
  pvc: number | null;
  parket: number | null;
  lijm: number | null;
}

export interface OwnMonth {
  month: string;
  /** Geaccepteerde omzet ex btw. */
  revenue: number;
  /** Gewogen gemiddelde inkoopprijs per m² op de verkochte vloerregels. */
  purchasePerM2: number | null;
}

export interface MarketData {
  confidence: ConfidencePoint[];
  prices: PricePoint[];
  own: OwnMonth[];
}

const toMonth = (p: string) => (/^\d{4}MM\d{2}$/.test(p) ? `${p.slice(0, 4)}-${p.slice(6, 8)}` : null);

async function get<T>(url: string): Promise<T[]> {
  const res = await fetch(url, { next: { revalidate: 86400 }, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CBS: HTTP ${res.status}`);
  return ((await res.json()) as { value?: T[] }).value ?? [];
}

async function fetchConfidence(from: string): Promise<ConfidencePoint[]> {
  const filter = encodeURIComponent(`Perioden ge '${from}'`);
  const rows = await get<{ Perioden: string; Consumentenvertrouwen_1: number | null; GunstigeTijdVoorGroteAankopen_8: number | null }>(
    `${VERTROUWEN}?$filter=${filter}&$select=Perioden,Consumentenvertrouwen_1,GunstigeTijdVoorGroteAankopen_8`,
  );
  return rows
    .map((r) => ({ month: toMonth(r.Perioden), confidence: r.Consumentenvertrouwen_1, bigPurchases: r.GunstigeTijdVoorGroteAankopen_8 }))
    .filter((r): r is ConfidencePoint => r.month != null);
}

async function fetchPrices(from: string): Promise<PricePoint[]> {
  const per = new Map<string, PricePoint>();
  await Promise.all(
    PRICE_SERIES.map(async (s) => {
      const filter = encodeURIComponent(
        `AlleProdComCoderingen eq '${s.code}' and Afzetgebieden eq '${INVOERPRIJZEN}' and Perioden ge '${from}'`,
      );
      const rows = await get<{ Perioden: string; ProducentenprijsindexPPI_1: number | null }>(
        `${PPI}?$filter=${filter}&$select=Perioden,ProducentenprijsindexPPI_1`,
      );
      for (const r of rows) {
        const month = toMonth(r.Perioden);
        if (!month) continue;
        const p = per.get(month) ?? { month, pvc: null, parket: null, lijm: null };
        p[s.key] = r.ProducentenprijsindexPPI_1;
        per.set(month, p);
      }
    }),
  );
  return [...per.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Eigen omzet en inkoopprijs per maand, om naast de markt te leggen. */
export function ownByMonth(quotations: QuotationRow[], exclusions: Set<string>, from: string): OwnMonth[] {
  const per = new Map<string, { revenue: number; inkoop: number; m2: number }>();
  for (const q of quotations) {
    if (q.status !== 'accepted' || exclusions.has(q.id) || !q.dateAccepted || q.dateAccepted < from) continue;
    const m = q.dateAccepted.slice(0, 7);
    const e = per.get(m) ?? { revenue: 0, inkoop: 0, m2: 0 };
    e.revenue += q.revenueExVat;
    for (const l of q.lines ?? []) {
      if (l.purchasePerM2 == null || l.m2 <= 0) continue;
      e.inkoop += l.purchasePerM2 * l.m2;
      e.m2 += l.m2;
    }
    per.set(m, e);
  }
  return [...per.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, e]) => ({
      month,
      revenue: Math.round(e.revenue),
      purchasePerM2: e.m2 > 0 ? Math.round((e.inkoop / e.m2) * 100) / 100 : null,
    }));
}

export async function fetchMarket(quotations: QuotationRow[], exclusions: Set<string>): Promise<MarketData> {
  const [confidence, prices] = await Promise.all([
    fetchConfidence('2024MM01').catch(() => []),
    fetchPrices('2023MM01').catch(() => []),
  ]);
  return { confidence, prices, own: ownByMonth(quotations, exclusions, '2024-01-01') };
}
