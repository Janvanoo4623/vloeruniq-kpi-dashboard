// Tests op de rekenmodules: kleine, vaste voorbeelden waarvan de uitkomst met
// de hand na te rekenen is. Ze bestaan omdat een wijziging in de marge- of
// statuslogica anders pas opvalt als Jan een raar getal ziet.
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveQuotations, type ResolveInput } from '../lib/resolve';
import { invoicedMargin } from '../lib/invoiced-margin';
import { computeBreakEven, computeCallList, monthPace } from '../lib/today';
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

test('maandtempo: eerste vijf dagen geen oordeel, daarna voor/achter/op schema', () => {
  assert.equal(monthPace(0, 2, 30), null); // € 0 op dag 2 is geen "op schema"
  assert.equal(monthPace(0.5, 5, 30), null);
  assert.equal(monthPace(null, 20, 30), null);
  assert.equal(monthPace(0.2, 6, 30), 'op schema');
  assert.equal(monthPace(0.4, 6, 30), 'voor');
  assert.equal(monthPace(0.2, 15, 30), 'achter');
});

// ── Herkenning offerteregels ─────────────────────────────────────────────

test('gietvloer telt als vloer, "aanbrengen" is leggen; verwijderen en kurkstuc niet', async () => {
  const { parseQuotation } = await import('../lib/teamleader/matching');
  const regelTL = (description: string, quantity: number, amount: number) => ({
    description,
    quantity,
    total: { tax_exclusive: { amount } },
  });
  const summary = { id: 'q1', status: 'accepted', created_at: '2026-10-02T00:00:00Z', updated_at: '2026-10-22T00:00:00Z' };
  const detail = {
    grouped_lines: [
      {
        line_items: [
          regelTL('Lavasteen Gietvloer Marble | Incl. aanbrengen', 55, 4545),
          regelTL('Gietvloer verwijderen en afvoeren', 20, 300),
          regelTL('KorqStuc Snow | Incl. aanbrengen', 23, 1000),
        ],
      },
    ],
  };
  const q = parseQuotation(
    summary as never,
    detail as never,
    {},
    { pNumbers: {}, nameMatches: [{ name: 'lavasteen gietvloer', price: 25, label: 'Lavasteen Gietvloer' }] } as never,
    { alwaysPerM2: 10, gluedPerM2: 5, selfAdhesivePerM2: 6 },
  );
  assert.equal(q.totalM2, 55);
  // Vloer + "Gietvloer verwijderen" als overig product; KorqStuc valt erbuiten.
  assert.equal(q.lines?.length, 2);
  assert.equal(q.lines?.[1].code, 'Vloer verwijderen');
  assert.equal(q.lines?.[0].laborRule, 'included');
  assert.equal(q.lines?.[0].installMode, 'click');
  assert.equal(q.margin, 4545 - (25 + 10) * 55);
});

// ── Overige producten ────────────────────────────────────────────────────

test('overige producten: classificatie op echte offertetekst', async () => {
  const { classifyExtra } = await import('../lib/extras');
  const c = (d: string, q = 10, r = 500) => classifyExtra(d, q, r)?.code ?? null;
  assert.equal(c('Traprenovatie PVC dichte trap P330 antraciet| Incl. stootborden en neusprofielen zwart | Incl. montage', 26, 2471), 'Traprenovatie PVC dichte trap');
  assert.equal(c('Traprenovatie PVC open trap P730 Beige | Incl. 2 zijden zwarte neusprofielen', 26, 2471), 'Traprenovatie PVC open trap');
  assert.equal(c('Traprenovatie tapijt | incl. tapijt Touch of Cashmere kleur 92', 1, 992), 'Traprenovatie tapijt');
  assert.equal(c('Traprenovatie PVC Overzettredes P310 Antraciet | Incl. montage', 13, 913), 'Traprenovatie overzettreden');
  assert.equal(c('Traprenovatie PVC dichte trap | Incl. stootborden en neusprofielen | Incl. montage', 1, 1500), 'Traprenovatie PVC (hele trap)');
  // Een hele trap die zijn treden noemt, telt in treden.
  const twintig = classifyExtra('Traprenovatie PVC dichte trap 20 treden | Incl. montage', 1, 1900);
  assert.equal(twintig?.code, 'Traprenovatie PVC dichte trap');
  assert.equal(twintig?.quantity, 20);
  assert.equal(c('MDF Plint 90x12 gelakt wit RAL9010 | Incl. zaagverlies | Incl. montage | Prijs per m1', 60, 990), 'Plinten');
  assert.equal(c('Hoge plint 150x12 wit MDF incl. montage en kitten', 36, 594), 'Plinten');
  assert.equal(c('Plint Amsterdam 90x12 Wit MDF RAL9010 | Prijs per lengte', 25, 545), 'Plinten (per lengte)');
  assert.equal(c('Entreemat Classic Antraciet | Incl. montage | Ingang voorzijde', 3.9, 230), 'Entreemat');
  assert.equal(c('PVC vloer verwijderen en afvoeren', 45, 558), 'Vloer verwijderen');
  assert.equal(c('Tapijttegels Skyper 6488 | incl. leggen tapijttegels', 125, 3750), 'Tapijt');
  // Geen overig product: vloeren, afwerking, losse trapmaterialen, radiatoren.
  assert.equal(c('Klik PVC Pure met geïntegreerde ondervloer | Incl. leggen klik pvc en afwerken met plakplint'), null);
  assert.equal(c('Snijden en kitten langs bestaande plint', 77, 382), null);
  assert.equal(c('Hightack plintenkit | Per tube', 5, 23), null);
  assert.equal(c('Trapprofielset 4x130cm RVS | Per 4 stuks', 3.75, 103), null);
  assert.equal(c('PVC Visgraat tbv plateau trap | Incl. 10% snijverlies'), null);
  assert.equal(c('Verwijderen, afdoppen en afvoeren radiatoren', 8, 298), null);
});

const trap = (qty: number, revenue: number): QuotationLine => ({
  code: 'Traprenovatie PVC dichte trap',
  kind: 'extra',
  unit: 'trede',
  qty,
  revenue,
  m2: 0,
  margin: null,
});

test('overig product: kostprijs × aantal, telt mee in marge maar niet in m²', () => {
  const [q] = resolveQuotations(
    [offerte({ id: 'a', lines: [regel('P100', 10, 400), trap(13, 1300)], omzetVloer: 400, totalM2: 10, revenueExVat: 1700 })],
    invoer({ prices: [{ code: 'P100', price: 10, effectiveFrom: '2000-01-01' }, { code: 'Traprenovatie PVC dichte trap', price: 60, effectiveFrom: '2000-01-01' }] }),
  );
  // Vloer: 400 − 10×10 = 300. Trap: 1300 − 60×13 = 520.
  assert.equal(q.margin, 820);
  assert.equal(q.marginPct, Math.round((820 / 1700) * 1000) / 10);
  assert.equal(q.totalM2, 10);
  assert.equal(q.matchCoverage, 100);
});

test('overig product zonder kostprijs: geen marge, telt niet mee in de noemer', () => {
  const [q] = resolveQuotations(
    [offerte({ id: 'a', lines: [regel('P100', 10, 400), trap(13, 1300)], omzetVloer: 400, totalM2: 10 })],
    invoer(),
  );
  assert.equal(q.margin, 300);
  assert.equal(q.marginPct, 75);
  assert.equal(q.lines?.[1].margin, null);
});

test('alleen een traprenovatie met kostprijs: marge zonder vloer', () => {
  const [q] = resolveQuotations(
    [offerte({ id: 'a', lines: [trap(13, 1300)], omzetVloer: 0, totalM2: 0, revenueExVat: 1300 })],
    invoer({ prices: [{ code: 'Traprenovatie PVC dichte trap', price: 60, effectiveFrom: '2000-01-01' }] }),
  );
  assert.equal(q.margin, 520);
  assert.equal(q.marginPct, 40);
});

test('kostprijs van een overig product komt nooit op een vloerregel', () => {
  // "tapijt" staat in de omschrijving van de vloer, maar Tapijt is een overig product.
  const vloer: QuotationLine = { ...regel('PVC Stroken Alba', 10, 400), desc: 'PVC Stroken Alba | incl. verwijderen tapijt' };
  const [q] = resolveQuotations(
    [offerte({ id: 'a', lines: [vloer] })],
    invoer({ prices: [{ code: 'Tapijt', price: 30, effectiveFrom: '2000-01-01' }] }),
  );
  assert.equal(q.margin, null);
});

test('nacalculatie: plinten alleen op de factuur komen bij de offerte, wat er al op stond niet dubbel', () => {
  const plint = (qty: number, revenue: number): QuotationLine => ({ code: 'Plinten', kind: 'extra', unit: 'm1', qty, revenue, m2: 0, margin: null });
  const prijzen = [
    { code: 'P100', price: 10, effectiveFrom: '2000-01-01' },
    { code: 'Plinten', price: 8, effectiveFrom: '2000-01-01' },
  ];
  const [q] = resolveQuotations(
    [offerte({ id: 'a', dealId: 'd1', lines: [regel('P100', 10, 400), plint(20, 300)], omzetVloer: 400, totalM2: 10, revenueExVat: 700 })],
    invoer({
      prices: prijzen,
      // Op de factuur: 50 m plint voor 750. Er stond 20 m / 300 op de offerte → 30 m / 450 nacalculatie.
      invoicedPerDeal: { d1: 1150 },
      invoiceExtras: { d1: [{ code: 'Plinten', unit: 'm1', qty: 50, revenue: 750 }] },
    }),
  );
  const nacalc = q.lines?.find((l) => l.source === 'factuur');
  assert.equal(nacalc?.qty, 30);
  assert.equal(nacalc?.revenue, 450);
  assert.equal(q.revenueExVat, 1150);
  // Vloer 300 + plint op offerte (300 − 160) + nacalculatie (450 − 240) = 650
  assert.equal(q.margin, 650);
});

test('nacalculatie: minder gefactureerd dan geoffreerd voegt niets toe', () => {
  const plint: QuotationLine = { code: 'Plinten', kind: 'extra', unit: 'm1', qty: 20, revenue: 300, m2: 0, margin: null };
  const [q] = resolveQuotations(
    [offerte({ id: 'a', dealId: 'd1', lines: [regel('P100', 10, 400), plint], omzetVloer: 400, totalM2: 10, revenueExVat: 700 })],
    invoer({ invoiceExtras: { d1: [{ code: 'Plinten', unit: 'm1', qty: 10, revenue: 150 }] } }),
  );
  assert.equal(q.lines?.length, 2);
  assert.equal(q.revenueExVat, 700);
});

test('nacalculatie: nooit meer dan er boven de offerte is gefactureerd', () => {
  const [q] = resolveQuotations(
    [offerte({ id: 'a', dealId: 'd1', lines: [regel('P100', 10, 400)], omzetVloer: 400, totalM2: 10, revenueExVat: 1000 })],
    invoer({
      // Plint van 300 op de factuur, maar er is maar 100 méér gefactureerd dan de offerte.
      invoicedPerDeal: { d1: 1100 },
      invoiceExtras: { d1: [{ code: 'Plinten', unit: 'm1', qty: 30, revenue: 300 }] },
    }),
  );
  const nacalc = q.lines?.find((l) => l.source === 'factuur');
  assert.equal(nacalc?.revenue, 100);
  assert.equal(nacalc?.qty, 10);
  assert.equal(q.revenueExVat, 1100);
});
