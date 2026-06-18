// Seed a DEMO snapshot so the dashboard can be viewed without live Teamleader
// access. Fabricated rows are run through the real buildSnapshot() so all totals
// are internally consistent. Run: `npm run seed:demo`.
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { store } from '../lib/store';
import { buildSnapshot } from '../lib/teamleader/aggregate';
import { deriveDateParts } from '../lib/teamleader/dates';
import type { QuotationRow, RunTimeRow } from '../lib/types';

// Deterministic PRNG (mulberry32) so the demo is stable across runs.
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20260618);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);

const REF_DATE = new Date('2026-06-18T00:00:00Z');
function dateNDaysAgo(n: number): string {
  const d = new Date(REF_DATE);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0];
}

const NAMES = [
  'Jan de Vries', 'Marijke van den Berg', 'Pieter Bakker', 'Sanne Jansen',
  'Tom Visser', 'Lisa Smit', 'Kees Mulder', 'Anne de Boer', 'Bram Kok',
  'Eva Bos', 'Daan Peters', 'Femke Hendriks', 'Ruben Dijkstra', 'Noa Vermeer',
];
const PRODUCTS = ['P620', 'P400', 'P310', 'P509', 'VT Wonen Herringbone', 'P730', 'P450', 'VT Wonen Basic'];
const CITIES = ['Rijssen', 'Enschede', 'Almelo', 'Hengelo', 'Deventer', 'Zwolle', 'Apeldoorn', 'Wierden'];
const SOURCES = ['Google', 'Mond op mond reclame', 'Netwerk', 'Social media'];
const SOURCE_WEIGHTS = [0.42, 0.32, 0.16, 0.1];

function weightedSource(): string {
  const r = rand();
  let acc = 0;
  for (let i = 0; i < SOURCES.length; i++) {
    acc += SOURCE_WEIGHTS[i];
    if (r <= acc) return SOURCES[i];
  }
  return SOURCES[0];
}

// ── Run-time deals (won) ────────────────────────────────────────────────
const runTimeRows: RunTimeRow[] = [];
for (let i = 0; i < 43; i++) {
  const closed = dateNDaysAgo(Math.floor(between(2, 88)));
  const runTimeDays = Math.floor(between(7, 140));
  const exec = (() => {
    const d = new Date(`${closed}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + runTimeDays - 1);
    return d.toISOString().split('T')[0];
  })();
  const parts = deriveDateParts(closed);
  runTimeRows.push({
    dealId: `demo-deal-${i}`,
    title: `Offerte ${pick(NAMES)}`,
    dateAccepted: closed,
    dateExecution: exec,
    runTimeDays,
    leadSource: weightedSource(),
    ...parts,
  });
}

// ── Quotations ──────────────────────────────────────────────────────────
const quotations: QuotationRow[] = [];
let q = 0;

function makeQuotation(status: QuotationRow['status'], dayAgo: number, dealId: string): QuotationRow {
  const date = dateNDaysAgo(dayAgo);
  const m2 = Math.round(between(30, 250));
  const pricePerM2 = between(45, 60);
  const omzetVloer = Math.round(m2 * pricePerM2 * 100) / 100;
  const revenueExVat = Math.round(omzetVloer * between(1.05, 1.25) * 100) / 100;
  const marginPctRaw = between(18, 42);
  const margin = status === 'accepted' ? Math.round(omzetVloer * (marginPctRaw / 100) * 100) / 100 : null;
  const cost = margin != null ? Math.round((omzetVloer - margin) * 100) / 100 : null;
  const parts = deriveDateParts(date);
  return {
    id: `demo-q-${q++}`,
    name: `Offerte ${1000 + q}`,
    dealId,
    customerName: pick(NAMES),
    city: pick(CITIES),
    postalCode: `${Math.floor(between(7000, 7999))}AB`,
    status,
    dateCreated: status === 'open' ? date : dateNDaysAgo(dayAgo + Math.floor(between(2, 10))),
    dateAccepted: status === 'accepted' ? date : '',
    ...parts,
    revenueExVat,
    revenueInclVat: Math.round(revenueExVat * 1.21 * 100) / 100,
    omzetVloer,
    totalM2: m2,
    prijsPerM2: Math.round(pricePerM2 * 100) / 100,
    cost,
    margin,
    marginPct: margin != null && omzetVloer > 0 ? Math.round((margin / omzetVloer) * 1000) / 10 : null,
    matchCoverage: status === 'accepted' ? (rand() > 0.25 ? 100 : Math.round(between(40, 90))) : null,
    verified: status === 'accepted' ? rand() > 0.35 : false,
    products: rand() > 0.5 ? [pick(PRODUCTS), pick(PRODUCTS)].filter((v, i, a) => a.indexOf(v) === i) : [pick(PRODUCTS)],
  };
}

// 60 accepted (link ~70% to a won deal for lead-source revenue), 22 open, 8 refused.
for (let i = 0; i < 60; i++) {
  const dealId = rand() < 0.7 ? `demo-deal-${Math.floor(rand() * 43)}` : `demo-deal-x-${i}`;
  quotations.push(makeQuotation('accepted', Math.floor(between(2, 88)), dealId));
}
for (let i = 0; i < 22; i++) {
  quotations.push(makeQuotation('open', Math.floor(between(1, 40)), `demo-deal-o-${i}`));
}
for (let i = 0; i < 8; i++) {
  quotations.push(makeQuotation('refused', Math.floor(between(5, 80)), `demo-deal-r-${i}`));
}

// Derive product lines from each quotation's products (split evenly) for top-products.
const productLines = quotations.flatMap((q) => {
  if (!q.products.length) return [];
  const rev = q.omzetVloer / q.products.length;
  const m2 = q.totalM2 / q.products.length;
  const margin = q.margin != null ? q.margin / q.products.length : null;
  return q.products.map((code) => ({
    code,
    revenue: rev,
    m2,
    margin,
    status: q.status,
    quotationId: q.id,
  }));
});

const acceptedRev = quotations
  .filter((q) => q.status === 'accepted')
  .reduce((s, q) => s + q.revenueExVat, 0);
const invoicing = {
  invoicedExcl: Math.round(acceptedRev * 0.8 * 100) / 100,
  paidExcl: Math.round(acceptedRev * 0.55 * 100) / 100,
  outstandingIncl: Math.round(acceptedRev * 0.25 * 1.21 * 100) / 100,
  invoiceCount: 52,
  paidCount: 34,
  openCount: 18,
};

const snapshot = buildSnapshot(
  quotations,
  runTimeRows,
  productLines,
  invoicing,
  90,
  REF_DATE.toISOString(),
);

async function main() {
  await store.setSnapshot(snapshot);
  await store.setMeta({
    status: 'ok',
    startedAt: REF_DATE.toISOString(),
    lastSyncAt: snapshot.generatedAt,
    durationMs: 142000,
    counts: { quotations: quotations.length, runTime: runTimeRows.length, pushedToTeamleader: 0 },
    error: null,
  });
  console.log(`[seed:demo] backend=${store.backend()} — wrote DEMO snapshot`);
  console.log(`  accepted=${snapshot.revenue.totals.acceptedRevenue} open=${snapshot.revenue.totals.openRevenue}`);
  console.log(`  weeks=${snapshot.weeks.length} leadSources=${snapshot.leadSources.length} quotations=${quotations.length}`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
