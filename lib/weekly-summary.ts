// Weekoverzicht voor Jan: elke maandagochtend een korte mail over de vorige
// week (maandag t/m zondag), verstuurd door n8n via GET /api/samenvatting.
//
// Alles komt uit dezelfde functies als het dashboard (snapshotForRange,
// summarizeInvoices, computeAging), zodat de mail nooit iets anders zegt dan het
// scherm. Hier wordt alleen gekozen WELKE cijfers en hoe ze in een mail staan.
import { snapshotForRange } from './range';
import { computeAging, summarizeInvoices } from './teamleader/invoices';
import { formatEuro, formatNumber, formatPercent } from './format';
import type { InvoiceAdjustment, InvoiceRow, QuotationRow, RunTimeRow } from './types';

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Maandag t/m zondag van de week vóór `asOf`, en die daarvoor. */
export function previousWeek(asOf: string): { from: string; to: string; prevFrom: string; prevTo: string } {
  const t = Date.parse(`${asOf}T00:00:00Z`);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // maandag = 0
  const thisMonday = t - dow * DAY;
  const from = thisMonday - 7 * DAY;
  return { from: iso(from), to: iso(thisMonday - DAY), prevFrom: iso(from - 7 * DAY), prevTo: iso(from - DAY) };
}

export interface WeeklySummary {
  from: string;
  to: string;
  won: { count: number; revenue: number; margin: number; marginPct: number; m2: number };
  wonPrev: { count: number; revenue: number; margin: number };
  newQuotes: { count: number; revenue: number };
  invoiced: number;
  paid: number;
  outstanding: number;
  overdue: { count: number; amount: number };
  /** Klussen met een datum uitvoering in de komende 7 dagen. */
  planned: { date: string; name: string; m2: number }[];
  /** Geaccepteerde offertes zonder marge (ontbrekende inkoopprijs) — staan onder Controleren. */
  withoutMargin: number;
  /** Grootste gewonnen offertes van de week. */
  topWon: { name: string; revenue: number; marginPct: number | null }[];
}

export function weeklySummary(input: {
  asOf: string;
  quotations: QuotationRow[]; // al door resolveQuotations heen
  deals: RunTimeRow[];
  invoices: InvoiceRow[];
  exclusions: Set<string>;
  adjustments?: Record<string, InvoiceAdjustment>;
}): WeeklySummary {
  const { asOf, quotations, deals, invoices, exclusions } = input;
  const w = previousWeek(asOf);
  const leeg = summarizeInvoices([]);
  const snap = snapshotForRange(quotations, deals, w.from, w.to, exclusions, leeg, asOf);
  const prev = snapshotForRange(quotations, deals, w.prevFrom, w.prevTo, exclusions, leeg, asOf);
  const t = snap.revenue.totals;
  const p = prev.revenue.totals;

  const telt = (q: QuotationRow) => !exclusions.has(q.id);
  const nieuw = quotations.filter((q) => telt(q) && q.dateCreated >= w.from && q.dateCreated <= w.to);
  const fact = summarizeInvoices(invoices.filter((i) => i.invoiceDate >= w.from && i.invoiceDate <= w.to));
  const aging = computeAging(invoices, asOf, quotations, input.adjustments ?? {});

  const byDeal = new Map<string, QuotationRow>();
  for (const q of quotations) if (q.dealId && q.status === 'accepted') byDeal.set(q.dealId, q);
  const eind = iso(Date.parse(`${asOf}T00:00:00Z`) + 6 * DAY);
  const planned = deals
    .filter((d) => d.dateExecution >= asOf && d.dateExecution <= eind)
    .map((d) => {
      const q = byDeal.get(d.dealId);
      return { date: d.dateExecution, name: q?.customerName || d.title, m2: q?.totalM2 ?? 0 };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const gewonnen = snap.quotations.filter((q) => q.status === 'accepted');
  return {
    from: w.from,
    to: w.to,
    won: { count: t.acceptedCount, revenue: t.acceptedRevenue, margin: t.totalMargin, marginPct: t.avgMarginPct, m2: t.m2Sold },
    wonPrev: { count: p.acceptedCount, revenue: p.acceptedRevenue, margin: p.totalMargin },
    newQuotes: { count: nieuw.length, revenue: nieuw.reduce((s, q) => s + q.revenueExVat, 0) },
    invoiced: fact.invoicedExcl,
    paid: fact.paidExcl,
    outstanding: aging.totalOutstanding,
    overdue: { count: aging.overdue.length, amount: aging.overdue.reduce((s, o) => s + o.amount, 0) },
    planned,
    withoutMargin: quotations.filter((q) => telt(q) && q.status === 'accepted' && q.margin == null).length,
    topWon: [...gewonnen]
      .sort((a, b) => b.revenueExVat - a.revenueExVat)
      .slice(0, 5)
      .map((q) => ({
        name: q.customerName,
        revenue: q.revenueExVat,
        marginPct: q.margin != null && q.revenueExVat > 0 ? (q.margin / q.revenueExVat) * 100 : null,
      })),
  };
}

const MAAND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const dag = (d: string) => `${Number(d.slice(8, 10))} ${MAAND[Number(d.slice(5, 7)) - 1]}`;
const DAGNAAM = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const dagnaam = (d: string) => DAGNAAM[new Date(`${d}T00:00:00Z`).getUTCDay()];

function verschil(nu: number, toen: number): string {
  const d = nu - toen;
  if (Math.abs(d) < 1) return 'gelijk aan de week ervoor';
  return `${d > 0 ? '+' : '−'}${formatEuro(Math.abs(d))} t.o.v. de week ervoor`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Onderwerp, platte tekst en eenvoudige HTML (mailclients: inline stijl, geen CSS-bestanden). */
export function weeklyMail(s: WeeklySummary, dashboardUrl: string): { subject: string; text: string; html: string } {
  const subject = `Vloeruniq week ${dag(s.from)} – ${dag(s.to)}: ${formatEuro(s.won.revenue)} gewonnen`;

  const blokken: { titel: string; regels: string[] }[] = [
    {
      titel: 'Verkoop',
      regels: [
        `Gewonnen: ${formatNumber(s.won.count)} offertes, ${formatEuro(s.won.revenue)} (${verschil(s.won.revenue, s.wonPrev.revenue)})`,
        `Marge: ${formatEuro(s.won.margin)} (${formatPercent(s.won.marginPct)}), ${formatNumber(s.won.m2)} m² verkocht`,
        `Nieuwe offertes: ${formatNumber(s.newQuotes.count)}, samen ${formatEuro(s.newQuotes.revenue)}`,
        ...s.topWon.map((q) => `  · ${q.name}: ${formatEuro(q.revenue)}${q.marginPct != null ? `, marge ${formatPercent(q.marginPct)}` : ', marge nog onbekend'}`),
      ],
    },
    {
      titel: 'Geld',
      regels: [
        `Gefactureerd: ${formatEuro(s.invoiced)} ex btw`,
        `Openstaand: ${formatEuro(s.outstanding)} incl btw, waarvan ${formatNumber(s.overdue.count)} facturen te laat (${formatEuro(s.overdue.amount)})`,
      ],
    },
    {
      titel: 'Deze week ingepland',
      regels:
        s.planned.length === 0
          ? ['Geen klussen met een datum uitvoering in Teamleader.']
          : s.planned.map((k) => `${dagnaam(k.date)} ${dag(k.date)}: ${k.name}${k.m2 > 0 ? ` (${formatNumber(k.m2)} m²)` : ''}`),
    },
  ];
  if (s.withoutMargin > 0) {
    blokken.push({
      titel: 'Te doen',
      regels: [`${formatNumber(s.withoutMargin)} geaccepteerde offertes zonder marge (inkoopprijs ontbreekt) — zie Controleren.`],
    });
  }

  const text = [
    `Weekoverzicht ${dag(s.from)} t/m ${dag(s.to)}`,
    '',
    ...blokken.flatMap((b) => [b.titel.toUpperCase(), ...b.regels.map((r) => (r.startsWith('  ·') ? r : `- ${r}`)), '']),
    `Dashboard: ${dashboardUrl}`,
  ].join('\n');

  const html = `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#111;max-width:560px">
<p style="font-size:18px;font-weight:600;margin:0 0 4px">Weekoverzicht ${dag(s.from)} t/m ${dag(s.to)}</p>
<p style="margin:0 0 16px;color:#666">Bedragen ex btw, behalve openstaand.</p>
${blokken
  .map(
    (b) => `<p style="font-weight:600;margin:16px 0 4px">${esc(b.titel)}</p>
<ul style="margin:0;padding-left:18px">${b.regels
      .map((r) => (r.startsWith('  ·') ? `<li style="list-style:none;margin-left:-4px;color:#555">${esc(r.trim())}</li>` : `<li>${esc(r)}</li>`))
      .join('')}</ul>`,
  )
  .join('\n')}
<p style="margin:20px 0 0"><a href="${esc(dashboardUrl)}" style="color:#0a7d45">Open het dashboard</a></p>
</div>`;

  return { subject, text, html };
}
