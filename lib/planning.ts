// Planning: wat staat er wanneer, en wat is gewonnen maar staat nog nergens.
//
// Bron: de uitvoerdatum op de deal in Teamleader (tabel `deals`, bestaat sinds
// februari 2026), gekoppeld aan de geaccepteerde offerte voor klant, plaats,
// m² en bedrag.
//
// "Nog in te plannen" = geaccepteerd in de laatste 120 dagen en zonder
// uitvoerdatum. Niet verder terug: een offerte van maart zonder datum is
// vrijwel zeker allang gelegd, alleen is de datum nooit ingevuld — die hoort
// niet op een lijst van werk dat nog moet gebeuren.
import type { QuotationRow, RunTimeRow } from './types';
import { formatProduct } from './format';

const DAY = 86400000;
const r0 = (v: number) => Math.round(v);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export interface Job {
  dealId: string;
  quotationId: string | null;
  date: string; // uitvoerdatum
  customer: string;
  city: string;
  m2: number;
  revenue: number;
  floor: string; // vloerproduct(en), leesbaar
}

export interface Unplanned {
  quotationId: string;
  customer: string;
  city: string;
  m2: number;
  revenue: number;
  floor: string;
  accepted: string;
  daysSince: number;
}

export interface WeekLoad {
  start: string; // maandag
  label: string; // W44
  m2: number;
  jobs: number;
  past: boolean;
  current: boolean;
}

export interface PlanningData {
  asOf: string;
  upcoming: Job[]; // alles met een uitvoerdatum vanaf vandaag
  unplanned: Unplanned[];
  weeks: WeekLoad[]; // 8 weken terug, deze week, 11 weken vooruit
  /** Gemiddeld gelegd per week over de laatste 12 volle weken. */
  laidPerWeek: number;
  plannedM2: number;
  plannedRevenue: number;
  unplannedM2: number;
  unplannedRevenue: number;
  /** Ingeplande m² ÷ capaciteit (of, zonder capaciteit, ÷ wat er gemiddeld gelegd wordt). */
  weeksOfWork: number | null;
  capacityPerWeek: number | null;
  /** Weken in de komende vier zonder één klus. */
  emptyWeeks: string[];
}

function mondayOf(d: string): number {
  const t = new Date(d + 'T00:00:00Z');
  return t.getTime() - ((t.getUTCDay() + 6) % 7) * DAY;
}

function weekLabel(monday: number): string {
  const d = new Date(monday + 3 * DAY);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return `W${1 + Math.round(((d.getTime() - jan4.getTime()) / DAY - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7)}`;
}

const vloer = (q: QuotationRow | undefined) => (q?.products?.length ? q.products.map(formatProduct).join(', ') : '');

export function computePlanning(
  deals: RunTimeRow[],
  quotations: QuotationRow[],
  exclusions: Set<string>,
  asOf: string,
  capacityPerWeek: number | null,
): PlanningData {
  const perDeal = new Map<string, QuotationRow>();
  for (const q of quotations) if (q.dealId && q.status === 'accepted' && !exclusions.has(q.id)) perDeal.set(q.dealId, q);
  const metDatum = new Set(deals.filter((d) => d.dateExecution).map((d) => d.dealId));

  const upcoming: Job[] = deals
    .filter((d) => d.dateExecution && d.dateExecution >= asOf)
    .map((d) => {
      const q = perDeal.get(d.dealId);
      return {
        dealId: d.dealId,
        quotationId: q?.id ?? null,
        date: d.dateExecution,
        customer: q?.customerName || d.title,
        city: q?.city ?? '',
        m2: r0(q?.totalM2 ?? 0),
        revenue: r0(q?.revenueExVat ?? 0),
        floor: vloer(q),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const grens = iso(Date.parse(asOf) - 120 * DAY);
  const unplanned: Unplanned[] = quotations
    .filter((q) => q.status === 'accepted' && !exclusions.has(q.id) && q.dateAccepted >= grens && q.dealId && !metDatum.has(q.dealId))
    .map((q) => ({
      quotationId: q.id,
      customer: q.customerName || q.name,
      city: q.city,
      m2: r0(q.totalM2),
      revenue: r0(q.revenueExVat),
      floor: vloer(q),
      accepted: q.dateAccepted,
      daysSince: Math.floor((Date.parse(asOf) - Date.parse(q.dateAccepted)) / DAY),
    }))
    .sort((a, b) => a.accepted.localeCompare(b.accepted));

  // Weken: 8 terug, deze, 11 vooruit.
  const dezeWeek = mondayOf(asOf);
  const weeks: WeekLoad[] = Array.from({ length: 20 }, (_, i) => {
    const start = dezeWeek + (i - 8) * 7 * DAY;
    return { start: iso(start), label: weekLabel(start), m2: 0, jobs: 0, past: i < 8, current: i === 8 };
  });
  for (const d of deals) {
    if (!d.dateExecution) continue;
    const i = Math.floor((mondayOf(d.dateExecution) - (dezeWeek - 8 * 7 * DAY)) / (7 * DAY));
    const w = weeks[i];
    if (!w) continue;
    w.m2 += perDeal.get(d.dealId)?.totalM2 ?? 0;
    w.jobs += 1;
  }
  weeks.forEach((w) => (w.m2 = r0(w.m2)));

  // Gemiddeld gelegd per week: de laatste 12 volle weken.
  const sinds = iso(dezeWeek - 12 * 7 * DAY);
  const gelegd = deals
    .filter((d) => d.dateExecution && d.dateExecution >= sinds && d.dateExecution < iso(dezeWeek))
    .reduce((t, d) => t + (perDeal.get(d.dealId)?.totalM2 ?? 0), 0);
  const laidPerWeek = r0(gelegd / 12);

  const plannedM2 = upcoming.reduce((t, j) => t + j.m2, 0);
  const tempo = capacityPerWeek ?? laidPerWeek;
  const emptyWeeks = weeks.filter((w) => !w.past && w.jobs === 0).slice(0, 4).filter((w) => Date.parse(w.start) < dezeWeek + 4 * 7 * DAY).map((w) => w.label);

  return {
    asOf,
    upcoming,
    unplanned,
    weeks,
    laidPerWeek,
    plannedM2,
    plannedRevenue: upcoming.reduce((t, j) => t + j.revenue, 0),
    unplannedM2: unplanned.reduce((t, u) => t + u.m2, 0),
    unplannedRevenue: unplanned.reduce((t, u) => t + u.revenue, 0),
    weeksOfWork: tempo > 0 ? Math.round((plannedM2 / tempo) * 10) / 10 : null,
    capacityPerWeek,
    emptyWeeks,
  };
}
