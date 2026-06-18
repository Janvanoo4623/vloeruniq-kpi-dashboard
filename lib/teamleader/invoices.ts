// Invoicing summary: quoted-vs-invoiced insight. Fetches invoices in the
// lookback window and aggregates booked / paid / outstanding amounts.
import { fetchAllPages } from './client';
import { round } from './dates';
import type { InvoicingSummary } from '../types';

interface TLInvoice {
  invoice_date?: string;
  status?: string; // 'draft' | 'booked' | 'outstanding' | ...
  paid?: boolean;
  total?: {
    tax_exclusive?: { amount: number };
    due?: { amount: number }; // outstanding amount incl VAT
  };
}

/** Aggregate invoices (booked, i.e. non-draft) within the lookback window. */
export async function fetchInvoicing(cutoff: string): Promise<InvoicingSummary> {
  const invoices = await fetchAllPages<TLInvoice>('/invoices.list', {
    filter: { invoice_date_after: cutoff },
  });

  let invoicedExcl = 0;
  let paidExcl = 0;
  let outstandingIncl = 0;
  let invoiceCount = 0;
  let paidCount = 0;
  let openCount = 0;

  for (const inv of invoices) {
    if ((inv.status ?? '') === 'draft') continue; // ignore drafts (not real invoices yet)
    const excl = inv.total?.tax_exclusive?.amount ?? 0;
    const due = inv.total?.due?.amount ?? 0;

    invoicedExcl += excl;
    invoiceCount += 1;
    if (inv.paid) {
      paidExcl += excl;
      paidCount += 1;
    } else {
      outstandingIncl += due;
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
