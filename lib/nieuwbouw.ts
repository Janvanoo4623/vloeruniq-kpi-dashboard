// Vergunde nieuwbouwwoningen per gemeente, naast de eigen omzet daar.
//
// Verhuizingen (zie market-share.ts) zijn de vraag van vandaag. Een verleende
// bouwvergunning is de vraag van over anderhalf tot twee jaar: die woning krijgt
// een vloer, en de gemeente staat er al bij. Dat maakt dit de enige open bron
// die iets zegt over waar het wérk heen gaat in plaats van waar het is geweest.
//
// Wat dit niet is: een orderportefeuille. Een vergunning is geen woning, een
// deel wordt nooit gebouwd, en een nieuwbouwwoning komt lang niet altijd bij
// Vloeruniq terecht. Het cijfer is bruikbaar om gemeenten ONDERLING te
// vergelijken en om te zien of ergens iets op gang komt, niet als voorspelling.
import type { QuotationRow } from './types';
import { normaliseCity } from './insights';
import { gemeenteCodeVoor, type CbsNieuwbouw } from './cbs';

export interface NieuwbouwRow {
  code: string; // GM....
  gemeente: string;
  plaatsen: string[];
  /** Vergunde woningen in de laatste vier kwartalen. */
  permitsJaar: number;
  /** Idem in de vier kwartalen daarvóór — om de beweging te zien. */
  permitsVorigJaar: number;
  /** Verschil in procenten, null als er vorig jaar niets was. */
  groeiPct: number | null;
  /** Eigen geaccepteerde omzet in die gemeente, over dezelfde 12 maanden. */
  revenue: number;
  /** Eigen geaccepteerde offertes daar. */
  won: number;
}

export interface NieuwbouwOverview {
  rows: NieuwbouwRow[];
  /** Kwartaalreeks over alle gemeenten samen, oplopend. */
  reeks: { period: string; permits: number }[];
  permitsJaar: number;
  permitsVorigJaar: number;
  groeiPct: number | null;
  /** Laatste kwartaal waarvoor CBS cijfers heeft. */
  cbsThrough: string | null;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** "2026-K2" → de begindatum van dat kwartaal, om offertes op te knippen. */
function kwartaalStart(period: string): string {
  const [jaar, k] = period.split('-K');
  const maand = (Number(k) - 1) * 3 + 1;
  return `${jaar}-${String(maand).padStart(2, '0')}-01`;
}

export function buildNieuwbouw(
  quotations: QuotationRow[],
  permitsByCode: Record<string, CbsNieuwbouw[]>,
  gemeenteNamen: Record<string, string>,
): NieuwbouwOverview {
  // Alle kwartalen die CBS heeft, oplopend. De laatste vier zijn "dit jaar", de
  // vier daarvoor het vergelijkingsjaar.
  const alleKwartalen = [
    ...new Set(Object.values(permitsByCode).flatMap((r) => r.map((p) => p.period))),
  ].sort();
  const laatsteVier = alleKwartalen.slice(-4);
  const vorigeVier = alleKwartalen.slice(-8, -4);
  const cbsThrough = alleKwartalen[alleKwartalen.length - 1] ?? null;

  // Eigen omzet per gemeente over dezelfde twaalf maanden, zodat "veel
  // vergunningen, weinig omzet" een eerlijke vergelijking is.
  const vanaf = laatsteVier.length > 0 ? kwartaalStart(laatsteVier[0]) : null;
  const omzetPerCode = new Map<string, { revenue: number; won: number; plaatsen: Set<string> }>();
  if (vanaf) {
    for (const q of quotations) {
      if (q.status !== 'accepted') continue;
      const datum = q.dateAccepted || q.dateCreated;
      if (!datum || datum < vanaf) continue;
      const plaats = normaliseCity(q.city || '');
      const code = plaats ? gemeenteCodeVoor(plaats) : null;
      if (!code) continue;
      const e = omzetPerCode.get(code) ?? { revenue: 0, won: 0, plaatsen: new Set<string>() };
      e.revenue += q.revenueExVat;
      e.won += 1;
      if (plaats) e.plaatsen.add(plaats);
      omzetPerCode.set(code, e);
    }
  }

  const som = (reeks: CbsNieuwbouw[], kwartalen: string[]) =>
    reeks.filter((p) => kwartalen.includes(p.period)).reduce((s, p) => s + p.permits, 0);

  const rows: NieuwbouwRow[] = [];
  for (const [code, reeks] of Object.entries(permitsByCode)) {
    if (reeks.length === 0) continue;
    const permitsJaar = som(reeks, laatsteVier);
    const permitsVorigJaar = som(reeks, vorigeVier);
    const eigen = omzetPerCode.get(code);
    rows.push({
      code,
      gemeente: gemeenteNamen[code] ?? code,
      plaatsen: [...(eigen?.plaatsen ?? [])].sort(),
      permitsJaar,
      permitsVorigJaar,
      groeiPct:
        permitsVorigJaar > 0
          ? round1(((permitsJaar - permitsVorigJaar) / permitsVorigJaar) * 100)
          : null,
      revenue: Math.round(eigen?.revenue ?? 0),
      won: eigen?.won ?? 0,
    });
  }
  rows.sort((a, b) => b.permitsJaar - a.permitsJaar);

  // Reeks over alle gemeenten samen.
  const perPeriode = new Map<string, number>();
  for (const reeks of Object.values(permitsByCode)) {
    for (const p of reeks) perPeriode.set(p.period, (perPeriode.get(p.period) ?? 0) + p.permits);
  }
  const totaalJaar = rows.reduce((s, r) => s + r.permitsJaar, 0);
  const totaalVorig = rows.reduce((s, r) => s + r.permitsVorigJaar, 0);

  return {
    rows,
    reeks: [...perPeriode.entries()]
      .map(([period, permits]) => ({ period, permits }))
      .sort((a, b) => a.period.localeCompare(b.period)),
    permitsJaar: totaalJaar,
    permitsVorigJaar: totaalVorig,
    groeiPct: totaalVorig > 0 ? round1(((totaalJaar - totaalVorig) / totaalVorig) * 100) : null,
    cbsThrough,
  };
}
