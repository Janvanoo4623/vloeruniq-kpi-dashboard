// GET /api/data?from&to&compare — alles wat van de periode afhangt, voor de
// periodekiezer. Zelfde functie als de layout gebruikt (lib/period-data.ts).
// Session-gated by proxy.ts.
import { NextResponse } from 'next/server';
import { getAllQuotations, getAllDeals, getExclusions, getAllInvoices, getResolveInput } from '@/lib/db';
import { resolveQuotations } from '@/lib/resolve';
import { buildPeriodData } from '@/lib/period-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().split('T')[0];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const today = iso(Date.now());
  const to = url.searchParams.get('to') || today;
  const from = url.searchParams.get('from') || iso(Date.now() - 89 * DAY);
  const compare = url.searchParams.get('compare') || 'none'; // none | previous | year

  const [allQuotations, deals, exclusions, invoices, resolveInput] = await Promise.all([
    getAllQuotations(),
    getAllDeals(),
    getExclusions(),
    getAllInvoices(),
    getResolveInput(),
  ]);
  // Marges worden hier berekend, niet bij het synchroniseren: prijzen en kosten
  // gelden per offertedatum, plus eventuele handmatige correcties.
  const quotations = resolveQuotations(allQuotations, resolveInput);

  const data = await buildPeriodData({ quotations, deals, invoices, exclusions, from, to, compare });
  return NextResponse.json({ ...data, compare });
}
