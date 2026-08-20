// Datakwaliteit als meetbaar cijfer in plaats van een gevoel.
//
// De aanleiding: de fouten die vandaag boven water kwamen — een niet-opgehaalde
// status, ontbrekende inkoopprijzen, een leadbron die nauwelijks wordt ingevuld —
// waren allemaal maanden onzichtbaar. Niet omdat ze verstopt zaten, maar omdat
// niemand ernaar kéék. Een cijfer dat elke sync opnieuw wordt gemeten en bewaard
// verandert "de data wordt beter" van een indruk in iets dat je kunt aanwijzen.
import type { InvoiceRow, QuotationRow, RunTimeRow } from './types';
import type { PriceRow } from './pricing';
import { computeMissingPrices, computeUnmatchedQuotations } from './missing-prices';

export type MetricStatus = 'good' | 'warn' | 'crit';

export interface QualityMetric {
  key: string;
  label: string;
  /** Het getal zelf, als percentage of aantal. */
  value: number;
  unit: '%' | 'aantal' | 'dagen';
  status: MetricStatus;
  /** Eén zin: wat betekent dit en wat kost het. */
  meaning: string;
  /** Eén zin: wat je eraan doet. */
  action: string;
  /** Waar die actie zit. */
  href?: string;
}

export interface QualitySnapshot {
  date: string; // YYYY-MM-DD
  scores: Record<string, number>;
  /** Gewogen totaalcijfer, 0–100. */
  overall: number;
}

export interface QualityReport {
  metrics: QualityMetric[];
  overall: number;
  history: QualitySnapshot[];
}

const pct = (deel: number, geheel: number) => (geheel > 0 ? Math.round((deel / geheel) * 1000) / 10 : 0);

/**
 * Drempels bewust ruim: dit is een stuurmiddel, geen examen. Rood betekent "hier
 * gaan cijfers de mist in", amber "let op", groen "hier hoef je niets aan te doen".
 */
function status(waarde: number, warn: number, crit: number): MetricStatus {
  if (waarde < crit) return 'crit';
  if (waarde < warn) return 'warn';
  return 'good';
}

export function computeQuality(
  quotations: QuotationRow[],
  deals: RunTimeRow[],
  invoices: InvoiceRow[],
  priceRows: PriceRow[],
  pricedCodes: Set<string>,
  today: string,
): Omit<QualityReport, 'history'> {
  const accepted = quotations.filter((q) => q.status === 'accepted');
  const acceptedRevenue = accepted.reduce((s, q) => s + q.revenueExVat, 0);

  // 1. Hoeveel van je omzet heeft überhaupt een marge?
  const metMarge = accepted.filter((q) => q.margin != null);
  const margeDekking = pct(
    metMarge.reduce((s, q) => s + q.revenueExVat, 0),
    acceptedRevenue,
  );

  // 2. Leadbron: op de deal, gekoppeld via dealId.
  const bronPerDeal = new Set(deals.filter((d) => d.leadSource).map((d) => d.dealId));
  const bronDekking = pct(
    accepted.filter((q) => bronPerDeal.has(q.dealId)).reduce((s, q) => s + q.revenueExVat, 0),
    acceptedRevenue,
  );

  // 3. Producten zonder inkoopprijs.
  const missing = computeMissingPrices(quotations, pricedCodes);
  const missingRevenue = missing.reduce((s, m) => s + m.revenue, 0);

  // 4. Offertes waarin geen vloer wordt herkend.
  const unmatched = computeUnmatchedQuotations(quotations);

  // 5. Ouderdom van de inkoopprijzen. Staat alles nog op de seed-datum, dan is de
  //    kostenkant per definitie vlak en is elke margetrend een verkoopprijseffect.
  const datums = [...new Set(priceRows.map((r) => r.effectiveFrom))].sort();
  const nieuwste = datums[datums.length - 1] ?? '2000-01-01';
  const prijsLeeftijd =
    nieuwste === '2000-01-01'
      ? -1 // nooit bijgewerkt
      : Math.floor((Date.parse(today) - Date.parse(nieuwste)) / 86400000);

  // 6. Plaats invullen — draagt de regio-analyse.
  const plaatsDekking = pct(quotations.filter((q) => q.city?.trim()).length, quotations.length);

  // 7. Betaaldatum — draagt het betaalgedrag.
  const geboekt = invoices.filter((i) => i.status !== 'draft');
  const betaald = geboekt.filter((i) => i.paid);
  const betaaldatumDekking = pct(betaald.filter((i) => i.paidAt).length, betaald.length);

  const metrics: QualityMetric[] = [
    {
      key: 'margin_coverage',
      label: 'Omzet met een berekende marge',
      value: margeDekking,
      unit: '%',
      status: status(margeDekking, 90, 75),
      meaning: `${100 - margeDekking}% van je geaccepteerde omzet heeft géén marge, en telt dus nergens mee in je margecijfers.`,
      action: 'Vul de ontbrekende inkoopprijzen in.',
      href: '/controleren',
    },
    {
      key: 'lead_source',
      label: 'Omzet met een leadbron',
      value: bronDekking,
      unit: '%',
      status: status(bronDekking, 80, 50),
      meaning:
        'Zonder leadbron weet je niet waar je omzet vandaan komt. Dit draagt straks ook de marketingkosten per kanaal.',
      action: 'Leadbron invullen bij de deal in Teamleader — dit los je niet in het dashboard op.',
    },
    {
      key: 'missing_prices',
      label: 'Vloeren zonder inkoopprijs',
      value: missing.length,
      unit: 'aantal',
      status: missing.length === 0 ? 'good' : missing.length < 20 ? 'warn' : 'crit',
      meaning: `Samen goed voor ${Math.round(missingRevenue).toLocaleString('nl-NL')} euro omzet zonder marge.`,
      action: 'Prijs invullen, grootste omzet eerst.',
      href: '/controleren',
    },
    {
      key: 'price_age',
      label: 'Laatste prijswijziging',
      value: prijsLeeftijd,
      unit: 'dagen',
      status: prijsLeeftijd < 0 ? 'crit' : status(400 - prijsLeeftijd, 220, 40),
      meaning:
        prijsLeeftijd < 0
          ? 'Geen enkele inkoopprijs is ooit bijgewerkt: alle 80 staan op de startdatum. De kostenkant is daardoor vlak, en elke margetrend die je ziet is puur een verkoopprijseffect.'
          : 'Inkoopprijzen bewegen mee met de markt; blijven ze staan, dan drijft je marge ongemerkt weg van de werkelijkheid.',
      action: 'Nieuwe prijs invoeren zodra de inkoop verandert — die geldt dan vanaf die datum.',
      href: '/instellingen',
    },
    {
      key: 'unmatched',
      label: 'Offertes zonder herkende vloer',
      value: unmatched.length,
      unit: 'aantal',
      status: unmatched.length === 0 ? 'good' : unmatched.length < 20 ? 'warn' : 'warn',
      meaning: 'Hun m² tellen nergens mee, want er is geen regel die als vloer wordt herkend.',
      action: 'Per offerte uitsluiten of op gezien zetten.',
      href: '/controleren',
    },
    {
      key: 'city',
      label: 'Offertes met een plaats',
      value: plaatsDekking,
      unit: '%',
      status: status(plaatsDekking, 90, 75),
      meaning: 'Draagt de regio-analyse en de vergelijking met de CBS-verhuiscijfers.',
      action: 'Adres invullen bij de klant in Teamleader.',
    },
    {
      key: 'paid_at',
      label: 'Betaalde facturen met een betaaldatum',
      value: betaaldatumDekking,
      unit: '%',
      status: status(betaaldatumDekking, 90, 75),
      meaning: 'Zonder betaaldatum valt er geen betaaltermijn te berekenen.',
      action: 'Komt automatisch mee uit Teamleader; blijft dit laag, dan wordt er buiten Teamleader om afgeboekt.',
    },
  ];

  // Totaalcijfer: percentages tellen direct mee, aantallen vertalen we naar een
  // score zodat één maat het geheel kan dragen.
  const scores = metrics.map((m) => {
    if (m.unit === '%') return m.value;
    if (m.key === 'price_age') return m.value < 0 ? 0 : Math.max(0, 100 - m.value / 4);
    return m.value === 0 ? 100 : Math.max(0, 100 - m.value * 2);
  });
  const overall = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

  return { metrics, overall };
}

/** Eén meting, klaar om te bewaren. */
export function toSnapshot(
  report: Omit<QualityReport, 'history'>,
  date: string,
): QualitySnapshot {
  return {
    date,
    overall: report.overall,
    scores: Object.fromEntries(report.metrics.map((m) => [m.key, m.value])),
  };
}

/**
 * Voeg een meting toe aan de historie: één per dag, hooguit 90 bewaard. Meten bij
 * elke sync (drie keer per dag) zou de reeks vervuilen met ruis binnen een dag;
 * de laatste meting van een dag overschrijft de vorige.
 */
export function mergeHistory(
  history: QualitySnapshot[],
  nieuw: QualitySnapshot,
): QualitySnapshot[] {
  const zonderVandaag = history.filter((h) => h.date !== nieuw.date);
  return [...zonderVandaag, nieuw].sort((a, b) => a.date.localeCompare(b.date)).slice(-90);
}
