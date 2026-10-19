// Tests op de rekenmodules: kleine, vaste voorbeelden waarvan de uitkomst met
// de hand na te rekenen is. Ze bestaan omdat een wijziging in de marge- of
// statuslogica anders pas opvalt als Jan een raar getal ziet.
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveQuotations, type ResolveInput } from '../lib/resolve';
import { invoicedMargin } from '../lib/invoiced-margin';
import { computeBreakEven, computeCallList } from '../lib/today';
import { computeCashForecast } from '../lib/cash-forecast';
import { deltaTone } from '../lib/signal';
import type { InvoiceRow, QuotationLine, QuotationRow } from '../lib/types';
import type { MoneybirdPL } from '../lib/moneybird';

// ── Hulpjes ──────────────────────────────────────────────────────────────

/** Klikvloer zonder legservice: kostprijs = alleen inkoop × m². */
const regel = (code: string, m2: number, revenue: number): QuotationLine => ({
  code,
  m2,
  revenue,
  margin: null,
  installMode: 'click',
  laborRule: 'excluded',
});

function offerte(p: Partial<QuotationRow> & { id: string; lines?: QuotationLine[] }): QuotationRow {
  const lines = p.lines ?? [];
  const omzetVloer = lines.reduce((t, l) => t + l.revenue, 0);
  const totalM2 = lines.reduce((t, l) => t + l.m2, 0);
  return {
    name: p.id,
    dealId: '',
    customerName: p.id,
    city: '',
    postalCode: '',
    status: 'accepted',
    dateCreated: '2026-09-01',
    dateAccepted: '2026-09-05',
    month: '2026-09',
    quarter: 'Q3 2026',
    year: '2026',
    revenueExVat: omzetVloer,
    revenueInclVat: omzetVloer * 1.21,
    omzetVloer,
    totalM2,
    prijsPerM2: totalM2 ? omzetVloer / totalM2 : 0,
    cost: null,
    margin: null,
    marginPct: null,
    matchCoverage: null,
    verified: false,
    products: [],
    lines,
    ...p,
  } as QuotationRow;
}

const invoer = (extra: Partial<ResolveInput> = {}): ResolveInput => ({
  prices: [{ code: 'P100', price: 10, effectiveFrom: '2000-01-01' }],
  costs: [],
  overrides: {},
  ...extra,
});

function factuur(p: Partial<InvoiceRow> & { id: string; totalExcl: number }): InvoiceRow {
  return {
    invoiceDate: '2026-10-01',
    status: 'booked',
    paid: false,
    dueIncl: p.totalExcl * 1.21,
    customerId: '',
    dueOn: '2026-10-15',
    customerName: 'Klant',
    paidAt: '',
    dealId: '',
    ...p,
  };
}

// ── Marge ────────────────────────────────────────────────────────────────

test('volledige dekking: marge = vloeromzet − inkoop', () => {
  const [q] = resolveQuotations([offerte({ id: 'a', lines: [regel('P100', 100, 3000)] })], invoer());
  assert.equal(q.cost, 1000);
  assert.equal(q.margin, 2000);
  assert.equal(q.matchCoverage, 100);
});

test('onvolledige dekking: marge naar rato, onbeprijsde regel is geen pure winst', () => {
  // 40 m² beprijsd (omzet 1200, inkoop 400 → 2/3 marge), 60 m² zonder prijs (omzet 1800).
  const [q] = resolveQuotations(
    [offerte({ id: 'b', lines: [regel('P100', 40, 1200), regel('ONBEKEND', 60, 1800)] })],
    invoer(),
  );
  // Oud zou zijn: 3000 − 400 = 2600 (87%). Naar rato: 2/3 × 3000 = 2000.
  assert.equal(q.margin, 2000);
  assert.equal(q.matchCoverage, 40);
});

test('zonder enige inkoopprijs: geen marge', () => {
  const [q] = resolveQuotations([offerte({ id: 'c', lines: [regel('ONBEKEND', 10, 500)] })], invoer());
  assert.equal(q.margin, null);
});

// ── Gefactureerd = gewonnen ──────────────────────────────────────────────

test('verlopen offerte met facturen op de deal telt als gewonnen', () => {
  const qs = [
    offerte({ id: 'v1', dealId: 'd1', status: 'expired', revenueExVat: 5000, lines: [regel('P100', 10, 5000)] }),
    offerte({ id: 'v2', dealId: 'd1', status: 'expired', revenueExVat: 3000, lines: [regel('P100', 10, 3000)] }),
  ];
  const r = resolveQuotations(qs, invoer({ invoicedPerDeal: { d1: 3100 } }));
  const gewonnen = r.filter((q) => q.status === 'accepted');
  assert.equal(gewonnen.length, 1, 'precies één versie per deal');
  assert.equal(gewonnen[0].id, 'v2', 'de versie die het dichtst bij het gefactureerde ligt');
  assert.equal(gewonnen[0].wonByInvoice, true);
  assert.equal(gewonnen[0].sourceStatus, 'expired');
});

test('deal met al een geaccepteerde offerte blijft ongemoeid', () => {
  const qs = [
    offerte({ id: 'a1', dealId: 'd2', status: 'accepted' }),
    offerte({ id: 'a2', dealId: 'd2', status: 'expired' }),
  ];
  const r = resolveQuotations(qs, invoer({ invoicedPerDeal: { d2: 1000 } }));
  assert.equal(r.find((q) => q.id === 'a2')?.status, 'expired');
  assert.equal(r.some((q) => q.wonByInvoice), false);
});

test('handmatig gezette status gaat vóór de factuur', () => {
  const qs = [offerte({ id: 'h1', dealId: 'd3', status: 'expired' })];
  const r = resolveQuotations(
    qs,
    invoer({ invoicedPerDeal: { d3: 1000 }, overrides: { h1: { prices: {}, noLabor: false, fields: { status: 'refused' } } as never } }),
  );
  assert.equal(r[0].status, 'refused');
});

// ── Marge op facturen ────────────────────────────────────────────────────

test('factuurmarge: aanbetaling draagt zijn aandeel van de offertemarge', () => {
  const [q] = resolveQuotations([offerte({ id: 'f1', dealId: 'd4', lines: [regel('P100', 100, 3000)] })], invoer());
  const facturen = [factuur({ id: 'i1', totalExcl: 1200, dealId: 'd4' }), factuur({ id: 'i2', totalExcl: 500 })];
  const m = invoicedMargin(facturen, [q], new Set(), '2026-10-01', '2026-10-31');
  assert.equal(m.margin, 800, '1200 / 3000 × 2000');
  assert.equal(m.parts.ok.amount, 1200);
  assert.equal(m.parts['geen-offerte'].amount, 500);
});

// ── Belijst, break-even, cashprognose ────────────────────────────────────

test('belijst: offertes jonger dan vijf dagen staan er niet op, sortering op verwachte opbrengst', () => {
  const qs = [
    offerte({ id: 'oud', status: 'open', dateCreated: '2026-10-01', dateAccepted: '', revenueExVat: 2000 }),
    offerte({ id: 'groot', status: 'open', dateCreated: '2026-10-05', dateAccepted: '', revenueExVat: 9000 }),
    offerte({ id: 'vers', status: 'open', dateCreated: '2026-10-18', dateAccepted: '', revenueExVat: 50000 }),
    // Historie voor de kanscurve: zes gewonnen na 30 dagen, zes verloren → 50% kans tot dag 30.
    ...Array.from({ length: 6 }, (_, i) => offerte({ id: `w${i}`, dateCreated: '2026-01-01', dateAccepted: '2026-01-31' })),
    ...Array.from({ length: 6 }, (_, i) => offerte({ id: `l${i}`, status: 'expired', dateCreated: '2026-01-01', dateAccepted: '2026-01-01' })),
  ];
  const lijst = computeCallList(qs, new Set(), '2026-10-20');
  assert.deepEqual(lijst.items.map((c) => c.quotationId), ['groot', 'oud']);
  assert.equal(lijst.items[0].winChance, 50);
});

test('break-even: vaste lasten gedeeld door brutomarge', () => {
  const pl: MoneybirdPL = {
    syncedAt: null,
    error: null,
    administrationName: null,
    periodStart: null,
    accounts: [],
    months: [{ month: '2026-09', values: {}, revenue: 0, directCosts: 60000, expenses: 20000, other: 0 }],
  };
  const be = computeBreakEven(pl, new Map([['2026-09', 100000]]), '2026-06', '2026-10-20');
  assert.ok(be);
  assert.equal(be.grossMarginPct, 40);
  assert.equal(be.revenueNeeded, 50000);
});

test('cashprognose: inkoop voor gepland werk telt niet dubbel met openstaande inkoopfacturen', () => {
  const pl: MoneybirdPL = {
    syncedAt: null,
    error: null,
    administrationName: null,
    periodStart: null,
    accounts: [],
    months: [{ month: '2026-09', values: {}, revenue: 0, directCosts: 50000, expenses: 0, other: 0 }],
    bankBalance: 10000,
    openPurchases: [{ id: 'p', supplier: 'X', date: '2026-10-10', dueDate: '2026-10-25', open: 100000, late: false }],
  };
  const q = offerte({ id: 'g', dealId: 'dg', revenueExVat: 20000 });
  const f = computeCashForecast({
    pl,
    invoices: [],
    adjustments: {},
    deals: [{ dealId: 'dg', title: 'g', dateAccepted: '2026-10-01', dateExecution: '2026-11-03', runTimeDays: 0, leadSource: '', month: '', quarter: '', year: '' }],
    quotations: [q],
    revenueByMonth: new Map([['2026-09', 100000]]),
    startMonth: '2026-06',
    medianDaysToPay: 7,
    asOf: '2026-10-20',
  });
  const materiaal = f.weeks.reduce((t, w) => t + w.outMaterials, 0);
  assert.equal(materiaal, 0, 'de openstaande inkoop (100k) dekt de geschatte inkoop al');
  assert.equal(f.weeks.reduce((t, w) => t + w.outPurchases, 0), 100000);
});

// ── Verschil-pillen ──────────────────────────────────────────────────────

test('deltaTone: klein verschil of te weinig offertes blijft neutraal', () => {
  assert.equal(deltaTone(10, { sample: 50 }), 'neutral');
  assert.equal(deltaTone(-40, { sample: 5 }), 'neutral');
  assert.equal(deltaTone(-40, { sample: 50 }), 'crit');
  assert.equal(deltaTone(-40, { sample: 50, higherIsBetter: false }), 'good');
});
