// GET /api/samenvatting — het weekoverzicht (vorige week, maandag t/m zondag)
// als onderwerp + tekst + HTML, voor de maandagmail die n8n verstuurt.
//
// Leest alleen Supabase, nooit Teamleader. Beveiligd met dezelfde sleutel als
// /api/planning: dezelfde afnemer (n8n), en wie de planning mag vullen mag ook
// deze cijfers lezen. proxy.ts laat dit pad door zonder sessiecookie.
import { NextResponse } from 'next/server';
import { getAllDeals, getAllInvoices, getAllQuotations, getExclusions, getInvoiceAdjustments, getResolveInput } from '@/lib/db';
import { resolveQuotations } from '@/lib/resolve';
import { weeklyMail, weeklySummary } from '@/lib/weekly-summary';
import { authorized } from '@/lib/planning-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DASHBOARD_URL = 'https://vloeruniq-kpi-dashboard.vercel.app';

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  // ?asOf=YYYY-MM-DD om een andere week na te rekenen; standaard vandaag (Amsterdam).
  const asOf =
    url.searchParams.get('asOf')?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ??
    new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });

  const [quotations, deals, invoices, exclusions, resolveInput, adjustments] = await Promise.all([
    getAllQuotations(),
    getAllDeals(),
    getAllInvoices(),
    getExclusions(),
    getResolveInput(),
    getInvoiceAdjustments(),
  ]);
  const summary = weeklySummary({
    asOf,
    quotations: resolveQuotations(quotations, resolveInput),
    deals,
    invoices,
    exclusions,
    adjustments,
  });
  return NextResponse.json({ ok: true, ...weeklyMail(summary, DASHBOARD_URL), summary });
}
