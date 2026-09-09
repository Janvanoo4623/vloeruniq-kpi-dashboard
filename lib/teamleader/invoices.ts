// Invoices: fetch raw invoices from Teamleader (stored in Supabase) and
// summarize booked/paid/outstanding. Summary can be computed for any date range.
import { fetchAllPages } from './client';
import { dateOnly, round } from './dates';
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
  paid_at?: string | null; // datetime when fully paid
  due_on?: string | null;
  total?: {
    tax_exclusive?: { amount: number };
    due?: { amount: number };
  };
  invoicee?: { name?: string; customer?: { id?: string } | null } | null;
}

interface TLCreditNote {
  id?: string;
  credit_note_date?: string;
  status?: string;
  total?: { tax_exclusive?: { amount: number }; tax_inclusive?: { amount: number } };
  invoicee?: { name?: string; customer?: { id?: string } | null } | null;
}

/**
 * Creditnota's. Ze staan in Teamleader in een eigen lijst en zijn dus nooit
 * meegekomen met de facturen — met als gevolg dat een klant die geld terugkreeg
 * in "Klanten op omzet" nog steeds voor het volle bedrag bovenaan stond.
 *
 * Ze worden opgeslagen als factuur met een negatief bedrag. Daardoor is er geen
 * migratie nodig en herkent alles wat facturen leest ze vanzelf als credit
 * (`totalExcl < 0`), inclusief de ene creditregel die al langer als negatieve
 * factuur in de data zat.
 *
 * De endpointnaam en het datumfilter zijn niet hard: mislukt de aanroep, dan
 * levert deze functie een lege lijst en gaat de rest van de sync gewoon door.
 * Een sync die klapt op een bijzaak is erger dan een ontbrekende creditnota.
 */
export async function fetchCreditNotes(cutoff: string): Promise<InvoiceRow[]> {
  let notes: TLCreditNote[] = [];
  try {
    notes = await fetchAllPages<TLCreditNote>('/creditNotes.list', {
      filter: { credit_note_date_after: cutoff },
    });
  } catch {
    try {
      notes = await fetchAllPages<TLCreditNote>('/creditNotes.list', {});
    } catch (err) {
      console.warn(
        '[sync] creditnota\'s niet opgehaald:',
        err instanceof Error ? err.message : err,
      );
      return [];
    }
  }

  const neg = (v: number | undefined) => -Math.abs(v ?? 0);
  return notes
    .filter((n) => n.id)
    .filter((n) => !n.credit_note_date || dateOnly(n.credit_note_date) >= cutoff)
    .map((n) => ({
      id: n.id as string,
      invoiceDate: n.credit_note_date ? dateOnly(n.credit_note_date) : '',
      status: n.status ?? 'creditnota',
      // Een creditnota staat niet open: hij verrekent. Vandaar betaald, zonder
      // openstaand bedrag, zodat hij nergens in de cashflow-aging opduikt.
      paid: true,
      totalExcl: neg(n.total?.tax_exclusive?.amount),
      dueIncl: 0,
      customerId: n.invoicee?.customer?.id ?? '',
      dueOn: '',
      customerName: n.invoicee?.name ?? '',
      paidAt: n.credit_note_date ? dateOnly(n.credit_note_date) : '',
    }));
}

/** Een creditnota (of een als negatief geboekte factuur) is geen omzet. */
export const isCredit = (inv: InvoiceRow): boolean => inv.totalExcl < 0;

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
      paidAt: inv.paid_at ? dateOnly(inv.paid_at) : '',
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
