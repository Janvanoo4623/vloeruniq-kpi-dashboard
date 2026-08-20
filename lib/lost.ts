// Wat er niet doorging. De tegenhanger van de pijplijn.
//
// Deze analyse bestaat omdat vandaag bleek dat 427 offertes ter waarde van
// EUR 1,84 mln nooit in beeld waren: ze verliepen, en de sync haalde die status
// niet op. Nu ze wél binnenkomen is de vraag niet langer "hoeveel verliezen we"
// maar "wát verliezen we, en valt daar nog iets aan te doen".
import type { QuotationRow } from './types';
import { countsAsLost, type KpiSettings } from './kpi-settings';

const DAY = 86400000;
const round1 = (v: number) => Math.round(v * 10) / 10;

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export interface LostMonthPoint {
  month: string; // YYYY-MM
  wonRevenue: number;
  lostRevenue: number;
  wonCount: number;
  lostCount: number;
  /** Aandeel van de beslist geraakte omzet dat verloren ging. */
  lostShare: number | null;
}

export interface LostQuote {
  id: string;
  name: string;
  customerName: string;
  city: string;
  date: string;
  revenueExVat: number;
  totalM2: number;
  /** Dagen sinds de offerte verliep. */
  daysAgo: number;
  /** Verlopen of actief geweigerd — dat vraagt een ander gesprek. */
  reason: 'expired' | 'refused';
}

export interface LostOverview {
  months: LostMonthPoint[];
  /** De grootste gemiste offertes, om achteraan te bellen. */
  biggest: LostQuote[];
  totalLostRevenue: number;
  totalLostCount: number;
  /** Mediane offertewaarde, gewonnen versus verloren. */
  medianWon: number | null;
  medianLost: number | null;
  /** Verloren offertes van de laatste 90 dagen — daar is nog kans. */
  recentCount: number;
  recentRevenue: number;
  expiredShare: number;
}

/**
 * `asOf` en de instellingen bepalen samen wat "verloren" is; zie kpi-settings.
 * We tellen hier alleen wat écht beslist is, dus een offerte die simpelweg nog
 * open staat telt niet mee als verlies.
 */
export function computeLost(
  quotations: QuotationRow[],
  asOf: string,
  settings: KpiSettings,
): LostOverview {
  const asOfMs = Date.parse(asOf);
  const perMaand = new Map<string, LostMonthPoint>();
  const punt = (m: string) => {
    const p =
      perMaand.get(m) ??
      { month: m, wonRevenue: 0, lostRevenue: 0, wonCount: 0, lostCount: 0, lostShare: null };
    perMaand.set(m, p);
    return p;
  };

  const verloren: LostQuote[] = [];
  const gewonnenBedragen: number[] = [];
  const verlorenBedragen: number[] = [];
  let expired = 0;

  for (const q of quotations) {
    const datum = q.dateAccepted || q.dateCreated;
    if (!datum) continue;
    const maand = datum.substring(0, 7);

    if (q.status === 'accepted') {
      const p = punt(maand);
      p.wonRevenue += q.revenueExVat;
      p.wonCount += 1;
      gewonnenBedragen.push(q.revenueExVat);
      continue;
    }

    const leeftijd = q.dateCreated ? Math.floor((asOfMs - Date.parse(q.dateCreated)) / DAY) : 0;
    if (!countsAsLost(q.status, leeftijd, settings)) continue;

    const p = punt(maand);
    p.lostRevenue += q.revenueExVat;
    p.lostCount += 1;
    verlorenBedragen.push(q.revenueExVat);
    if (q.status === 'expired') expired += 1;

    verloren.push({
      id: q.id,
      name: q.name,
      customerName: q.customerName,
      city: q.city,
      date: datum,
      revenueExVat: q.revenueExVat,
      totalM2: q.totalM2,
      daysAgo: Math.max(0, Math.floor((asOfMs - Date.parse(datum)) / DAY)),
      reason: q.status === 'refused' ? 'refused' : 'expired',
    });
  }

  const months = [...perMaand.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((p) => {
      const beslist = p.wonRevenue + p.lostRevenue;
      return {
        ...p,
        wonRevenue: Math.round(p.wonRevenue),
        lostRevenue: Math.round(p.lostRevenue),
        lostShare: beslist > 0 ? round1((p.lostRevenue / beslist) * 100) : null,
      };
    });

  verloren.sort((a, b) => b.revenueExVat - a.revenueExVat);
  const recent = verloren.filter((v) => v.daysAgo <= 90);

  return {
    months,
    biggest: verloren.slice(0, 30),
    totalLostRevenue: Math.round(verlorenBedragen.reduce((s, v) => s + v, 0)),
    totalLostCount: verlorenBedragen.length,
    medianWon: median(gewonnenBedragen),
    medianLost: median(verlorenBedragen),
    recentCount: recent.length,
    recentRevenue: Math.round(recent.reduce((s, v) => s + v.revenueExVat, 0)),
    expiredShare: verlorenBedragen.length > 0 ? round1((expired / verlorenBedragen.length) * 100) : 0,
  };
}
