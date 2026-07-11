// GET /api/data?from&to&compare — aggregate stored quotations/deals/invoices for
// a date range, with optional period comparison. Session-gated by proxy.ts.
import { NextResponse } from 'next/server';
import { getAllQuotations, getAllDeals, getExclusions, getAllInvoices } from '@/lib/db';
import { summarizeInvoices } from '@/lib/teamleader/invoices';
import { snapshotForRange } from '@/lib/range';
import type { InvoiceRow, InvoicingSummary } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().split('T')[0];

function shiftYear(date: string, years: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().split('T')[0];
}

const EMPTY_INVOICING: InvoicingSummary = {
  invoicedExcl: 0,
  paidExcl: 0,
  outstandingIncl: 0,
  invoiceCount: 0,
  paidCount: 0,
  openCount: 0,
};

const invoicingForRange = (invoices: InvoiceRow[], from: string, to: string): InvoicingSummary =>
  summarizeInvoices(invoices.filter((inv) => inv.invoiceDate >= from && inv.invoiceDate <= to));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const today = iso(Date.now());
  const to = url.searchParams.get('to') || today;
  const from = url.searchParams.get('from') || iso(Date.now() - 89 * DAY);
  const compare = url.searchParams.get('compare') || 'none'; // none | previous | year

  const [quotations, deals, exclusions, invoices] = await Promise.all([
    getAllQuotations(),
    getAllDeals(),
    getExclusions(),
    getAllInvoices(),
  ]);
  const generatedAt = new Date().toISOString();

  const snapshot = snapshotForRange(
    quotations,
    deals,
    from,
    to,
    exclusions,
    invoicingForRange(invoices, from, to),
    generatedAt,
  );

  let comparison = null;
  if (compare === 'previous' || compare === 'year') {
    let prevFrom: string;
    let prevTo: string;
    if (compare === 'year') {
      prevFrom = shiftYear(from, -1);
      prevTo = shiftYear(to, -1);
    } else {
      const lenDays = Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
      prevTo = iso(Date.parse(from) - DAY);
      prevFrom = iso(Date.parse(prevTo) - (lenDays - 1) * DAY);
    }
    const prev = snapshotForRange(quotations, deals, prevFrom, prevTo, exclusions, EMPTY_INVOICING, generatedAt);
    comparison = {
      from: prevFrom,
      to: prevTo,
      revenue: prev.revenue.totals,
      runTime: prev.runTime.totals,
      invoicing: invoicingForRange(invoices, prevFrom, prevTo),
    };
  }

  return NextResponse.json({ range: { from, to }, compare, snapshot, comparison });
}
