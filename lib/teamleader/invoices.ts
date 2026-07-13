// Invoices: fetch raw invoices from Teamleader (stored in Supabase) and
// summarize booked/paid/outstanding. Summary can be computed for any date range.
import { fetchAllPages } from './client';
import { round } from './dates';
import { formatProduct } from '../format';
import type {
  AgingBucket,
  InvoiceRow,
  InvoicingSummary,
  OverdueInvoice,
  QuotationRow,
} from '../types';

interface TLInvoice {
  id?: string;
  invoice_date?: string;
  status?: string; // 'draft' | 'booked' | 'outstanding' | ...
  paid?: boolean;
  due_on?: string | null;
  total?: {
    tax_exclusive?: { amount: number };
    due?: { amount: number };
  };
  invoicee?: { name?: string; customer?: { id?: string } | null } | null;
}

/** Fetch invoices with invoice_date on/after `cutoff` and map to InvoiceRow. */
export async function fetchInvoices(cutoff: string): Promise<InvoiceRow[]> {
  const invoices = await fetchAllPages<TLInvoice>('/invoices.list', {
    filter: { invoice_date_after: cutoff },
  });
  return invoices
    .filter((inv) => inv.id)
    .map((inv) => ({
      id: inv.id as string,
      invoiceDate: inv.invoice_date ?? '',
      status: inv.status ?? '',
      paid: Boolean(inv.paid),
      totalExcl: inv.total?.tax_exclusive?.amount ?? 0,
      dueIncl: inv.total?.due?.amount ?? 0,
      customerId: inv.invoicee?.customer?.id ?? '',
      dueOn: inv.due_on ?? '',
      customerName: inv.invoicee?.name ?? '',
    }));
}

const BUCKETS = [
  { label: 'Nog niet vervallen', min: -Infinity, max: 0 },
  { label: '1–30 dagen', min: 1, max: 30 },
  { label: '31–60 dagen', min: 31, max: 60 },
  { label: '61–90 dagen', min: 61, max: 90 },
  { label: '90+ dagen', min: 91, max: Infinity },
] as const;

/** Customer(s) to omit from cashflow entirely (e.g. intercompany). */
const CASHFLOW_EXCLUDE = /nv\s*vloeren/i;

const normName = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Index accepted quotations by customer name so an invoice can borrow the
 * floor product(s) + m² of the matching project. When a customer has several
 * quotations we keep them all and pick the closest by ex-VAT amount at lookup.
 */
function indexQuotations(quotations: QuotationRow[]): Map<string, QuotationRow[]> {
  const byCustomer = new Map<string, QuotationRow[]>();
  for (const q of quotations) {
    if (!q.customerName) continue;
    const key = normName(q.customerName);
    (byCustomer.get(key) ?? byCustomer.set(key, []).get(key)!).push(q);
  }
  return byCustomer;
}

/** Find the quotation best matching an invoice (same customer, nearest ex-VAT total). */
function matchQuotation(
  inv: InvoiceRow,
  byCustomer: Map<string, QuotationRow[]>,
): QuotationRow | null {
  const candidates = inv.customerName ? byCustomer.get(normName(inv.customerName)) : undefined;
  if (!candidates || candidates.length === 0) return null;
  let best = candidates[0];
  let bestDiff = Math.abs(inv.totalExcl - best.revenueExVat);
  for (const q of candidates.slice(1)) {
    const diff = Math.abs(inv.totalExcl - q.revenueExVat);
    if (diff < bestDiff) {
      best = q;
      bestDiff = diff;
    }
  }
  return best;
}

/** Bucket outstanding (unpaid, non-draft) invoices by days past due, as of `asOf`. */
export function computeAging(
  invoices: InvoiceRow[],
  asOf: string,
  quotations: QuotationRow[] = [],
): { buckets: AgingBucket[]; overdue: OverdueInvoice[]; totalOutstanding: number } {
  const asOfMs = Date.parse(asOf);
  const DAY = 86400000;
  const byCustomer = indexQuotations(quotations);
  const buckets: AgingBucket[] = BUCKETS.map((b) => ({
    label: b.label,
    amount: 0,
    count: 0,
    invoices: [],
  }));
  const overdue: OverdueInvoice[] = [];
  let totalOutstanding = 0;

  for (const inv of invoices) {
    if (inv.status === 'draft' || inv.paid || inv.dueIncl <= 0) continue;
    if (CASHFLOW_EXCLUDE.test(inv.customerName)) continue;
    const ref = inv.dueOn || inv.invoiceDate;
    if (!ref) continue;
    const daysOverdue = Math.floor((asOfMs - Date.parse(ref)) / DAY);
    totalOutstanding += inv.dueIncl;

    const q = matchQuotation(inv, byCustomer);
    const vloer =
      q && q.products.length > 0
        ? [...new Set(q.products.map(formatProduct))].join(', ')
        : null;

    const bi = BUCKETS.findIndex((b) => daysOverdue >= b.min && daysOverdue <= b.max);
    if (bi >= 0) {
      buckets[bi].amount += inv.dueIncl;
      buckets[bi].count += 1;
      buckets[bi].invoices.push({
        id: inv.id,
        customerName: inv.customerName || inv.customerId || '—',
        invoiceDate: inv.invoiceDate,
        dueOn: inv.dueOn,
        amount: inv.dueIncl,
        daysOverdue,
        vloer,
        m2: q ? q.totalM2 : null,
      });
    }

    if (daysOverdue > 0) {
      overdue.push({
        id: inv.id,
        customerName: inv.customerName || inv.customerId || '—',
        invoiceDate: inv.invoiceDate,
        dueOn: inv.dueOn,
        amount: inv.dueIncl,
        daysOverdue,
        quotation: q,
      });
    }
  }

  buckets.forEach((b) => {
    b.amount = round(b.amount);
    b.invoices.sort((a, c) => c.amount - a.amount);
  });
  overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
  return { buckets, overdue: overdue.slice(0, 20), totalOutstanding: round(totalOutstanding) };
}

/** Aggregate a list of invoices (ignoring drafts) into a summary. */
export function summarizeInvoices(invoices: InvoiceRow[]): InvoicingSummary {
  let invoicedExcl = 0;
  let paidExcl = 0;
  let outstandingIncl = 0;
  let invoiceCount = 0;
  let paidCount = 0;
  let openCount = 0;

  for (const inv of invoices) {
    if (inv.status === 'draft') continue;
    invoicedExcl += inv.totalExcl;
    invoiceCount += 1;
    if (inv.paid) {
      paidExcl += inv.totalExcl;
      paidCount += 1;
    } else {
      outstandingIncl += inv.dueIncl;
      openCount += 1;
    }
  }

  return {
    invoicedExcl: round(invoicedExcl),
    paidExcl: round(paidExcl),
    outstandingIncl: round(outstandingIncl),
    invoiceCount,
    paidCount,
    openCount,
  };
}
