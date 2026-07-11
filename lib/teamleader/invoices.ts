// Invoices: fetch raw invoices from Teamleader (stored in Supabase) and
// summarize booked/paid/outstanding. Summary can be computed for any date range.
import { fetchAllPages } from './client';
import { round } from './dates';
import type { InvoiceRow, InvoicingSummary } from '../types';

interface TLInvoice {
  id?: string;
  invoice_date?: string;
  status?: string; // 'draft' | 'booked' | 'outstanding' | ...
  paid?: boolean;
  total?: {
    tax_exclusive?: { amount: number };
    due?: { amount: number };
  };
  invoicee?: { customer?: { id?: string } | null } | null;
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
    }));
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
