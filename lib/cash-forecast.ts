// Cashprognose: wat staat er over acht weken op de bank?
//
// Begin: het banksaldo uit Moneybird. Daarna per week:
//   + openstaande facturen (Teamleader) op hun vervaldatum;
//   + gepland werk (uitvoerdatum in de deal) dat nog gefactureerd moet worden,
//     op de uitvoerdatum plus de mediane betaaltermijn;
//   − openstaande inkoopfacturen (Moneybird) op hun vervaldatum;
//   − inkoop voor dat geplande werk, geschat met de echte verhouding directe
//     kosten / omzet, een week vóór de uitvoering — maar alleen voor zover die
//     niet al als openstaande inkoopfactuur meetelt;
//   − vaste lasten: het gemiddelde van de bedrijfskosten per maand.
//
// Twee bewuste keuzes. (1) Facturen die al meer dan 60 dagen over de
// vervaldatum zijn tellen niet mee als inkomsten — of dat geld komt is
// onzeker — en inkoopfacturen die al meer dan 30 dagen 'te laat' staan ook
// niet als uitgave: de bankkoppeling in Moneybird bestaat pas sinds september,
// dus die zijn vrijwel zeker betaald maar niet afgeletterd. Beide staan apart
// op de pagina, met het bedrag erbij. (2) Liever iets te voorzichtig dan te
// rooskleurig: bij twijfel tellen kosten mee. Btw-afdracht zit er niet in.
import type { InvoiceAdjustment, InvoiceRow, QuotationRow, RunTimeRow } from './types';
import type { MoneybirdPL } from './moneybird';
import { CASHFLOW_EXCLUDE } from './teamleader/invoices';

const DAY = 86400000;
const WEEKS = 8;
const r0 = (v: number) => Math.round(v);

export interface CashWeek {
  start: string; // maandag, YYYY-MM-DD
  label: string; // "W43"
  inInvoices: number;
  inPlanned: number;
  outPurchases: number;
  outMaterials: number;
  outFixed: number;
  net: number;
  balance: number; // saldo aan het eind van de week
}

export interface CashForecast {
  available: boolean;
  startBalance: number;
  weeks: CashWeek[];
  lowest: { balance: number; week: string } | null;
  endBalance: number;
  assumptions: {
    daysToPay: number;
    materialRatio: number; // % van de omzet
    fixedPerWeek: number;
  };
  excluded: {
    /** Facturen > 60 dagen over de vervaldatum: tellen niet mee als inkomsten. */
    doubtfulReceivables: { count: number; amount: number };
    /** Inkoopfacturen > 30 dagen 'te laat' in Moneybird: vermoedelijk al betaald. */
    stalePayables: { count: number; amount: number };
  };
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => isoDay(Date.parse(d) + n * DAY);

function mondayOf(d: string): string {
  const t = new Date(d + 'T00:00:00Z');
  const dow = (t.getUTCDay() + 6) % 7; // ma = 0
  return isoDay(t.getTime() - dow * DAY);
}

function isoWeekLabel(monday: string): string {
  const d = new Date(monday + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 3); // donderdag bepaalt het weeknummer
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / DAY - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `W${week}`;
}

export function computeCashForecast(input: {
  pl: MoneybirdPL;
  invoices: InvoiceRow[];
  adjustments: Record<string, InvoiceAdjustment>;
  deals: RunTimeRow[];
  quotations: QuotationRow[];
  revenueByMonth: Map<string, number>;
  startMonth: string;
  medianDaysToPay: number | null;
  asOf: string;
}): CashForecast {
  const { pl, asOf } = input;
  // Van klus tot geld: de factuur gaat ongeveer een week na de uitvoering de
  // deur uit, daarna de mediane betaaltermijn (factuur → betaling).
  const daysToPay = 7 + Math.max(0, Math.round(input.medianDaysToPay ?? 14));

  // Verhoudingen uit de complete maanden in Moneybird (zonder de lopende).
  const thisMonth = asOf.slice(0, 7);
  const maanden = pl.months.filter((m) => m.month >= input.startMonth && m.month < thisMonth).slice(-6);
  const omzet = maanden.reduce((s, m) => s + (input.revenueByMonth.get(m.month) ?? 0), 0);
  const direct = maanden.reduce((s, m) => s + m.directCosts, 0);
  const materialRatio = omzet > 0 ? direct / omzet : 0.55;
  const fixedPerMonth = maanden.length > 0 ? maanden.reduce((s, m) => s + m.expenses, 0) / maanden.length : 0;
  const fixedPerWeek = (fixedPerMonth * 12) / 52;

  const week0 = mondayOf(asOf);
  const weeks: CashWeek[] = Array.from({ length: WEEKS }, (_, i) => {
    const start = addDays(week0, i * 7);
    return { start, label: isoWeekLabel(start), inInvoices: 0, inPlanned: 0, outPurchases: 0, outMaterials: 0, outFixed: fixedPerWeek, net: 0, balance: 0 };
  });
  const end = addDays(week0, WEEKS * 7);
  // Alles wat al vervallen is valt in deze week: dat is wat je nu verwacht.
  const weekOf = (d: string): CashWeek | null => {
    if (d >= end) return null;
    if (d < week0) return weeks[0];
    return weeks[Math.floor((Date.parse(d) - Date.parse(week0)) / (7 * DAY))] ?? null;
  };

  // + Openstaande facturen
  const doubtful = { count: 0, amount: 0 };
  for (const inv of input.invoices) {
    if (inv.status === 'draft' || inv.paid || inv.dueIncl <= 0 || CASHFLOW_EXCLUDE.test(inv.customerName)) continue;
    const correctie = input.adjustments[inv.id];
    const open = correctie ? correctie.openIncl : inv.dueIncl;
    if (open <= 0) continue;
    const due = inv.dueOn || addDays(inv.invoiceDate, 14);
    if (Date.parse(asOf) - Date.parse(due) > 60 * DAY) {
      doubtful.count += 1;
      doubtful.amount += open;
      continue;
    }
    const w = weekOf(due);
    if (w) w.inInvoices += open;
  }

  // + Gepland werk, en − de inkoop daarvoor
  const accepted = new Map<string, QuotationRow>();
  for (const q of input.quotations) if (q.dealId && q.status === 'accepted') accepted.set(q.dealId, q);
  for (const d of input.deals) {
    if (!d.dateExecution || d.dateExecution < asOf) continue;
    const q = accepted.get(d.dealId);
    if (!q) continue;
    const inW = weekOf(addDays(d.dateExecution, daysToPay));
    if (inW) inW.inPlanned += q.revenueInclVat;
    const outW = weekOf(addDays(d.dateExecution, -7));
    if (outW) outW.outMaterials += q.revenueExVat * materialRatio * 1.21;
  }

  // − Openstaande inkoopfacturen
  const stale = { count: 0, amount: 0 };
  for (const p of pl.openPurchases ?? []) {
    const due = p.dueDate || addDays(p.date || asOf, 30);
    if (p.late && Date.parse(asOf) - Date.parse(due) > 30 * DAY) {
      stale.count += 1;
      stale.amount += p.open;
      continue;
    }
    const w = weekOf(due);
    if (w) w.outPurchases += p.open;
  }

  // Het materiaal voor gepland werk staat voor een groot deel al als
  // inkoopfactuur open. Beide meetellen is dubbel: de schatting telt alleen
  // voor zover hij groter is dan wat er al aan inkoop openstaat.
  const geschat = weeks.reduce((t, w) => t + w.outMaterials, 0);
  const alBinnen = weeks.reduce((t, w) => t + w.outPurchases, 0);
  const schaal = geschat > 0 ? Math.max(0, geschat - alBinnen) / geschat : 0;
  for (const w of weeks) w.outMaterials *= schaal;

  const startBalance = pl.bankBalance ?? 0;
  let saldo = startBalance;
  let lowest: CashForecast['lowest'] = null;
  for (const w of weeks) {
    w.net = w.inInvoices + w.inPlanned - w.outPurchases - w.outMaterials - w.outFixed;
    saldo += w.net;
    w.balance = saldo;
    if (!lowest || saldo < lowest.balance) lowest = { balance: r0(saldo), week: w.label };
    for (const k of ['inInvoices', 'inPlanned', 'outPurchases', 'outMaterials', 'outFixed', 'net', 'balance'] as const) w[k] = r0(w[k]);
  }

  return {
    available: pl.bankBalance != null,
    startBalance: r0(startBalance),
    weeks,
    lowest,
    endBalance: r0(saldo),
    assumptions: { daysToPay, materialRatio: Math.round(materialRatio * 1000) / 10, fixedPerWeek: r0(fixedPerWeek) },
    excluded: {
      doubtfulReceivables: { count: doubtful.count, amount: r0(doubtful.amount) },
      stalePayables: { count: stale.count, amount: r0(stale.amount) },
    },
  };
}
