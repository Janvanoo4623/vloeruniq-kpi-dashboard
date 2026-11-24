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

test('gietvloer telt als vloer, "aanbrengen" is leggen; verwijderen en kurkstuc niet als vloer', async () => {
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
  // Vloer + "Gietvloer verwijderen" en KorqStuc als overige producten (kurkstuc sinds 2026-11-19).
  assert.equal(q.lines?.length, 3);
  assert.equal(q.lines?.[1].code, 'Vloer verwijderen');
  assert.equal(q.lines?.[2].code, 'Kurkstuc');
  assert.equal(q.totalM2, 55);
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

test('overig product: materiaal × aantal + arbeid per trap, telt mee in marge maar niet in m²', () => {
  const [q] = resolveQuotations(
    [offerte({ id: 'a', lines: [regel('P100', 10, 400), trap(13, 1300)], omzetVloer: 400, totalM2: 10, revenueExVat: 1700 })],
    invoer({ prices: [{ code: 'P100', price: 10, effectiveFrom: '2000-01-01' }, { code: 'Traprenovatie PVC dichte trap', price: 60, effectiveFrom: '2000-01-01' }] }),
  );
  // Vloer: 400 − 10×10 = 300. Trap: 13 treden = 1 trap → 1300 − 60×13 − 360 arbeid = 160.
  assert.equal(q.margin, 460);
  assert.equal(q.marginPct, Math.round((460 / 1700) * 1000) / 10);
  assert.equal(q.lines?.[1].laborCost, 360);
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
  assert.equal(q.margin, 160);
  assert.equal(q.marginPct, 12.3);
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
  // Vloer 300 + plint op offerte (300 − 160 − 200 arbeid) + nacalculatie (450 − 240 − 300 arbeid) = 150
  assert.equal(q.margin, 150);
});

// ── Arbeid per categorie (2026-11-19) ────────────────────────────────────

const extra = (code: string, unit: QuotationLine['unit'], qty: number, revenue: number, desc = ''): QuotationLine => ({
  code, kind: 'extra', unit, qty, revenue, m2: 0, margin: null, desc,
});

test('arbeid: trappen uit treden, 1 per 14, of zoals de tekst zegt', async () => {
  const { stairsFromSteps } = await import('../lib/labor');
  assert.equal(stairsFromSteps(0), 0);
  assert.equal(stairsFromSteps(13), 1);
  assert.equal(stairsFromSteps(16), 1);
  assert.equal(stairsFromSteps(28), 2);
  assert.equal(stairsFromSteps(39), 3);
  assert.equal(stairsFromSteps(26, 'Traprenovatie PVC 2x trap'), 2);
  assert.equal(stairsFromSteps(12, '13 treden'), 1);
});

test('arbeid: plinten per lengte = 2,4 m, alleen leveren zonder arbeid, alleen montage zonder materiaalprijs', () => {
  const [q] = resolveQuotations(
    [offerte({
      id: 'a',
      lines: [
        extra('Plinten (per lengte)', 'lengte', 10, 300),
        extra('Plinten (alleen leveren)', 'm1', 10, 80),
        extra('Plinten (alleen montage)', 'm1', 10, 150),
      ],
      omzetVloer: 0, totalM2: 0, revenueExVat: 530,
    })],
    invoer({ prices: [
      { code: 'Plinten (per lengte)', price: 10, effectiveFrom: '2000-01-01' },
      { code: 'Plinten (alleen leveren)', price: 5, effectiveFrom: '2000-01-01' },
    ] }),
  );
  assert.equal(q.lines?.[0].laborCost, 240); // 10 lengtes × 2,4 m × €10
  assert.equal(q.lines?.[0].margin, 300 - 100 - 240);
  assert.equal(q.lines?.[1].margin, 80 - 50);
  assert.equal(q.lines?.[2].margin, 150 - 100); // geen prijs nodig: alleen arbeid
  assert.equal(q.margin, -40 + 30 + 50);
});

test('arbeid: tarief uit de kosteninstellingen met ingangsdatum, nooit als kostenpost per m²', () => {
  const offertes = [offerte({ id: 'a', lines: [regel('P100', 10, 400), extra('Plinten', 'm1', 10, 200)], omzetVloer: 400, totalM2: 10, revenueExVat: 600 })];
  const prijzen = [{ code: 'P100', price: 10, effectiveFrom: '2000-01-01' }, { code: 'Plinten', price: 4, effectiveFrom: '2000-01-01' }];
  const [standaard] = resolveQuotations(offertes, invoer({ prices: prijzen }));
  // Vloer 400 − 100 = 300 (legservice uitgesloten); plint 200 − 40 − 100 = 60.
  assert.equal(standaard.margin, 360);
  const [eigen] = resolveQuotations(offertes, invoer({ prices: prijzen, costs: [
    { key: 'arbeid:plinten', value: 12, effectiveFrom: '2026-01-01' },
    { key: 'arbeid:plinten', value: 50, effectiveFrom: '2026-12-01' }, // na de offertedatum: telt niet
  ] }));
  assert.equal(eigen.margin, 300 + (200 - 40 - 120));
});

test('arbeid: gietvloer krijgt het eigen legtarief in plaats van het algemene', () => {
  const giet = (desc: string): QuotationLine => ({ code: 'Lavasteen Gietvloer', m2: 10, revenue: 1000, margin: null, installMode: 'click', laborRule: 'included', desc });
  const prijzen = [{ code: 'Lavasteen Gietvloer', price: 25, effectiveFrom: '2000-01-01' }];
  const kosten = [{ key: 'labor', value: 11, effectiveFrom: '2000-01-01' }, { key: 'transport', value: 1, effectiveFrom: '2000-01-01' }];
  const [lava] = resolveQuotations([offerte({ id: 'a', lines: [giet('Lavasteen Gietvloer Marble | Incl. aanbrengen')] })], invoer({ prices: prijzen, costs: kosten }));
  // 1000 − (25 + 15 lavasteen + 1 transport) × 10
  assert.equal(lava.margin, 590);
  const [micro] = resolveQuotations([offerte({ id: 'a', lines: [giet('Concrada Microcement 2k gietvloer | Incl. aanbrengen')] })], invoer({ prices: [{ code: 'Lavasteen Gietvloer', price: 25, effectiveFrom: '2000-01-01' }], costs: kosten }));
  assert.equal(micro.margin, 1000 - (25 + 26 + 1) * 10);
});

test('overige producten: kurkstuc, sleuven en vloerverwarming op echte tekst', async () => {
  const { classifyExtra } = await import('../lib/extras');
  assert.equal(classifyExtra('Sleuven dichtzetten (tbv vloerverwarming)', 45, 373)?.code, 'Sleuven dichtzetten');
  assert.equal(classifyExtra('Dichtzetten sleuven met reparatiemortel', 30, 250)?.code, 'Sleuven dichtzetten');
  assert.equal(classifyExtra('Sleuven dichten, egaliseren, lijmen en leggen 2250,- ex btw', 1, 2250), null);
  const vv = classifyExtra('Vloerverwarming 6 groepen | incl. plaatsen verdeler en op druk zetten van het systeem.', 1, 2400);
  assert.deepEqual(vv, { code: 'Vloerverwarming', unit: 'groep', quantity: 6 });
  // Het aantal is hier het bedrag incl. btw: de groepen komen uit de tekst.
  assert.equal(classifyExtra('Vloerverwarming 9 groepen incl. montage en verdeler', 2645, 2185)?.quantity, 9);
  assert.equal(classifyExtra('Vloerverwarming 8 groepen (74m2) | Incl. montage en open verdeler | sleuven 100mm', 1, 3000)?.code, 'Vloerverwarming');
  assert.equal(classifyExtra('Vloerverwarming frezen', 1, 1557), null);
  assert.equal(classifyExtra('Eventueel meerprijs vloerverwarming 6 groepen a 100', 1, 100), null);
  assert.equal(classifyExtra('Badkamer voorzien van Kurkstuc | Wanden en plafond', 34.5, 2566)?.code, 'Kurkstuc');
  assert.equal(classifyExtra('Wand uitvlakken met Ardex R1 | Aanbrengen 2 lagen Korqstuc', 13, 1288)?.code, 'Kurkstuc');
  assert.equal(classifyExtra('VL 04 PVC Amtico Stucco Flax AROUC39 blauw | Incl. egaliseren, lijmen en leggen', 20, 1500), null);
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

// ── Korting naar rato (2026-11-18) ───────────────────────────────────────

test('korting: negatieve regel gaat van de vloer af, de plint houdt zijn prijs', async () => {
  const { parseQuotation } = await import('../lib/teamleader/matching');
  const regel = (description: string, quantity: number, amount: number) => ({
    description,
    quantity,
    total: { tax_exclusive: { amount } },
  });
  // Echte offerte 1219 (Donker): vloer + plint − "Regio korting", totaal 6647,94.
  const summary = {
    id: 'q1219',
    status: 'accepted',
    created_at: '2026-10-21T00:00:00Z',
    updated_at: '2026-10-22T00:00:00Z',
    total: { tax_exclusive: { amount: 6647.94 }, tax_inclusive: { amount: 8044 } },
  };
  const detail = {
    grouped_lines: [
      {
        line_items: [
          regel('PVC Visgraat XL EVC (P700) Beige | Incl. 10% snijverlies | Incl. lijmen en leggen', 110, 6090.91),
          regel('MDF Renovatieplint 90x18 gelakt wit RAL9010 | Incl. montage', 72, 1306.12),
          regel('Regio korting', 1, -749.09),
        ],
      },
    ],
  };
  const q = parseQuotation(
    summary as never,
    detail as never,
    {},
    { pNumbers: { P700: 30 }, nameMatches: [] } as never,
    { alwaysPerM2: 10, gluedPerM2: 5, selfAdhesivePerM2: 6 },
  );
  // Jan 2026-11-20: "de korting is niet over de plinten maar over de vloer".
  assert.equal(q.lines?.length, 2, 'de kortingsregel is geen product');
  assert.equal(q.lines?.[0].revenue, Math.round((6090.91 - 749.09) * 100) / 100);
  assert.equal(q.lines?.[0].revenueBeforeDiscount, 6090.91);
  assert.equal(q.omzetVloer, Math.round((6090.91 - 749.09) * 100) / 100);
  assert.equal(q.lines?.[1].revenue, 1306.12);
  assert.equal(q.lines?.[1].revenueBeforeDiscount, undefined);
  // Vloer + plint samen = offertetotaal (op afronding na).
  const som = (q.lines ?? []).reduce((t, l) => t + l.revenue, 0);
  assert.ok(Math.abs(som - 6647.94) < 0.02);
});

test('korting: zonder korting of zonder totaal blijven de bedragen gelijk', async () => {
  const { discountFactor } = await import('../lib/teamleader/matching');
  const d = { grouped_lines: [{ line_items: [{ total: { tax_exclusive: { amount: 1000 } } }] }] };
  assert.equal(discountFactor(d, 1000), 1);
  assert.equal(discountFactor(d, 0), 1, 'geen totaal: niets aannemen');
  assert.equal(discountFactor(d, 1200), 1, 'nooit boven 1');
  assert.equal(discountFactor(d, 900), 0.9);
});

test('korting zonder vloer, of groter dan de vloer: naar rato over alles', async () => {
  const { discountFactors } = await import('../lib/teamleader/matching');
  const r = (description: string, quantity: number, amount: number) => ({ description, quantity, total: { tax_exclusive: { amount } } });
  const alleenPlint = { grouped_lines: [{ line_items: [r('MDF Plint 90x12 | Incl. montage', 60, 1000), r('Korting', 1, -100)] }] };
  assert.deepEqual(discountFactors(alleenPlint, 900), { floor: 0.9, other: 0.9 });
  const kleineVloer = { grouped_lines: [{ line_items: [r('PVC Stroken P405 | Incl. leggen', 2, 100), r('MDF Plint 90x12 | Incl. montage', 60, 900), r('Korting', 1, -200)] }] };
  assert.deepEqual(discountFactors(kleineVloer, 800), { floor: 0.8, other: 0.8 });
  assert.deepEqual(discountFactors(kleineVloer, 1000), { floor: 1, other: 1 });
});

test('tapijt per strekkende meter wordt m² (meters × rolbreedte)', async () => {
  const { classifyExtra } = await import('../lib/extras');
  assert.equal(classifyExtra('Tapijt Nifty 0900 Groen 400cm breed | Incl. leggen | Prijs per strekkende meter', 5.6, 509)?.quantity, 22.4);
  assert.equal(classifyExtra('Tapijt Roxburgh kleur 87 incl. leggen | 500cm breed', 4.6, 490)?.quantity, 23);
  // Zonder breedte en zonder tekst: herkend aan de prijs, standaard 4 m.
  assert.equal(classifyExtra('Tapijt Touch of Cashmere kleur 72 | Incl. lijmen en leggen tapijt', 5.1, 716)?.quantity, 20.4);
  // Per m², ook met een rolbreedte erbij: niet omrekenen.
  assert.equal(classifyExtra('Tapijt Touch of Marrakesh 7614 | Incl. leggen tapijt | 400cm breed | Prijs per m2', 10.28, 446)?.quantity, undefined);
  assert.equal(classifyExtra('Tapijttegels Skyper 6488 | incl. leggen tapijttegels', 125, 3750)?.quantity, undefined);
});

test('korting op de factuur: nacalculatie rekent na korting, kortingsregel is geen plint', async () => {
  const { extrasFromInvoice } = await import('../lib/teamleader/invoice-extras');
  const regel = (description: string, quantity: number, amount: number) => ({
    description,
    quantity,
    total: { tax_exclusive: { amount } },
  });
  const lines = extrasFromInvoice({
    total: { tax_exclusive: { amount: 900 } },
    grouped_lines: [
      { line_items: [regel('MDF Plint 90x12 gelakt wit | Incl. montage', 50, 1000), regel('Plinten korting', 1, -100)] },
    ],
  });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].code, 'Plinten');
  assert.equal(lines[0].revenue, 900);
});

// ── Zelf vloerregels toevoegen (2026-11-18) ──────────────────────────────

test('toegevoegde vloerregel: offerte zonder herkende vloer krijgt m², vloeromzet en marge', () => {
  const q = offerte({ id: 'wessels', revenueExVat: 19140 });
  const added = { code: 'P100', m2: 400, revenue: 15000, installMode: 'click' as const, labor: false };
  const [r] = resolveQuotations(
    [q],
    invoer({ overrides: { wessels: { prices: {}, noLabor: false, fields: { addedLines: [added] } } } }),
  );
  assert.equal(r.totalM2, 400);
  assert.equal(r.omzetVloer, 15000);
  assert.equal(r.revenueExVat, 19140, 'offertebedrag blijft gelijk');
  assert.equal(r.margin, 15000 - 10 * 400);
  assert.equal(r.lines?.[0].source, 'handmatig');
  assert.ok(r.products.includes('P100'));
});

test('toegevoegde vloerregel verschuift de regelcorrecties niet', () => {
  const q = offerte({ id: 'q', lines: [regel('P100', 10, 500)] });
  const fields = {
    lines: { '0': { m2: 20 } },
    lineCount: 1,
    addedLines: [{ code: 'P100', m2: 5, revenue: 250, installMode: 'click' as const, labor: false }],
  };
  const [r] = resolveQuotations([q], invoer({ overrides: { q: { prices: {}, noLabor: false, fields } } }));
  assert.equal(r.lines?.[0].m2, 20, 'correctie op regel 0 blijft gelden');
  assert.equal(r.totalM2, 25);
  assert.equal(r.omzetVloer, 750);
});

test('vloerverwarming: staffel per aantal groepen, meerprijs tegels, alleen vanaf ingangsdatum', () => {
  const staffel = [
    { code: 'Vloerverwarming 5 groepen', price: 1640, effectiveFrom: '2026-01-01' },
    { code: 'Vloerverwarming 7 groepen', price: 1870, effectiveFrom: '2026-01-01' },
    { code: 'Vloerverwarming meerprijs tegelvloer', price: 200, effectiveFrom: '2026-01-01' },
  ];
  const vv = (id: string, groepen: number, omzet: number, desc: string, datum = '2026-08-21') =>
    offerte({ id, dateCreated: datum, revenueExVat: omzet, lines: [extra('Vloerverwarming', 'groep', groepen, omzet, desc)] });
  const [gewoon, tegel, oud] = resolveQuotations(
    [
      vv('a', 5, 2050, 'Vloerverwarming 5 groepen | incl. plaatsen verdeler'),
      vv('b', 7, 3504, 'Vloerverwarming 7 groepen | Door tegelvloer frezen'),
      vv('c', 5, 1558, 'Vloerverwarming 5 groepen | Incl. montage', '2025-07-08'),
    ],
    invoer({ prices: staffel }),
  );
  assert.equal(gewoon.lines?.[0].margin, 2050 - 1640);
  assert.equal(tegel.lines?.[0].margin, 3504 - 1870 - 7 * 200);
  // Vóór de lijst van 2026: geen inkoop bekend, dus geen marge (geen verlies op de oude lijst).
  assert.equal(oud.lines?.[0].margin, null);
  // Een staffelcode is nooit een vloerprijs.
  const [vloer] = resolveQuotations([offerte({ id: 'd', dateCreated: '2026-08-21', lines: [regel('PVC geschikt voor vloerverwarming 5 groepen', 10, 400)] })], invoer({ prices: staffel }));
  assert.equal(vloer.lines?.[0].margin, null);
});

test('vloerverwarming: extra groepen op de factuur kosten het verschil tussen de staffels', async () => {
  const { floorHeatingCost } = await import('../lib/floor-heating');
  const p = (c: string) => ({ 'Vloerverwarming 5 groepen': 1640, 'Vloerverwarming 6 groepen': 1760 } as Record<string, number>)[c] ?? null;
  assert.equal(floorHeatingCost(1, 'Nacalculatie', p, 5), 120);
  assert.equal(floorHeatingCost(6, '', p), 1760);
  assert.equal(floorHeatingCost(7, '', p), null);
});

test('weekoverzicht: vorige week is maandag t/m zondag, ook als de mail op zondag of maandag draait', async () => {
  const { previousWeek } = await import('../lib/weekly-summary');
  assert.deepEqual(previousWeek('2026-11-23'), { from: '2026-11-16', to: '2026-11-22', prevFrom: '2026-11-09', prevTo: '2026-11-15' });
  assert.equal(previousWeek('2026-11-29').from, '2026-11-16'); // zondag: nog steeds de week ervoor
  assert.equal(previousWeek('2026-01-05').from, '2025-12-29'); // over de jaargrens
});

// ── Per m²: vóór korting en hele offerte ─────────────────────────────────
test('perM2Stats: marge vóór korting en over de hele offerte', async () => {
  const { perM2Stats } = await import('../lib/insights');
  // 10 m² vloer, €500 op de regel, €50 korting → €450; inkoop €20/m² = €200.
  const vloer: QuotationLine = { ...regel('P100', 10, 450), revenueBeforeDiscount: 500, purchasePerM2: 20, margin: 250 };
  // Plus €100 plinten met €40 marge: offerte-omzet €550, offertemarge €290.
  const q = offerte({ id: 'a', lines: [vloer], revenueExVat: 550, margin: 290 });
  const s = perM2Stats([q]);
  assert.equal(s.revenuePerM2, 45);
  assert.equal(s.marginPerM2, 25);
  assert.equal(s.revenueBeforeDiscountPerM2, 50);
  assert.equal(s.discountPerM2, 5);
  assert.equal(s.marginBeforeDiscountPerM2, 30);
  assert.equal(s.marginBeforeDiscountPct, 60);
  assert.equal(s.wholeRevenuePerM2, 55);
  assert.equal(s.wholeMarginPerM2, 29);
  assert.equal(s.wholeMarginPct, 52.7);
});

// ── Los verkocht: ook geen arbeid op plinten, tenzij de regel montage noemt ──
test('noLabor haalt arbeid van overige producten, behalve bij "Incl. montage"', () => {
  const plak: QuotationLine = { code: 'Plinten', kind: 'extra', unit: 'm1', qty: 40, revenue: 200, m2: 0, margin: null, desc: 'Plakplint bodiax ultradun' };
  const mont: QuotationLine = { ...plak, qty: 10, revenue: 150, desc: 'MDF Plint 90x12 | Incl. montage' };
  const q = offerte({ id: 'los', lines: [regel('P100', 20, 500), plak, mont] });
  const [r] = resolveQuotations([q], invoer({ overrides: { los: { prices: { plinten: 3 }, noLabor: true } } }));
  const [, p, m] = r.lines!;
  assert.equal(p.laborCost, 0);
  assert.equal(p.margin, 200 - 40 * 3);
  assert.ok((m.laborCost ?? 0) > 0, 'montage-regel houdt zijn arbeid');
});
