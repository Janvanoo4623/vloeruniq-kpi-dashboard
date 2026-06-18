// Fetch + parse quotations (accepted / open / refused) within the lookback window.
// Mirrors fetchRevenue + fetchAllQuotations + parseQuotation from the script.
import { apiCall, mapLimit } from './client';
import { dateOnly } from './dates';
import { parseQuotation } from './matching';
import { FETCH_CONCURRENCY, PAGE_SIZE } from './constants';
import type { PriceConfig } from './price-map';
import type { CustomerInfo, QuotationRow, QuotationStatus } from '../types';
import type { TLQuotationSummary, TLQuotationDetail } from './tl-types';

/** A product line tagged with the owning quotation's status + id (for aggregation). */
export interface AggLine {
  code: string;
  revenue: number;
  m2: number;
  margin: number | null;
  status: QuotationStatus;
  quotationId: string;
}

/**
 * List quotations for one status, applying the same date filter as the script:
 * - accepted/refused: keep where updated_at >= cutoff (page to the end)
 * - open: keep where created_at >= cutoff, and stop early once a page's oldest
 *   created_at falls before the cutoff.
 */
async function fetchQuotationsByStatus(
  status: string,
  cutoff: string,
  filterOnUpdated: boolean,
): Promise<TLQuotationSummary[]> {
  const all: TLQuotationSummary[] = [];
  let page = 1;

  while (true) {
    const resp = await apiCall<{ data?: TLQuotationSummary[] }>('/quotations.list', {
      filter: { status },
      page: { size: PAGE_SIZE, number: page },
    });
    const data = resp.data ?? [];
    if (data.length === 0) break;

    for (const q of data) {
      const dateToCheck = filterOnUpdated ? dateOnly(q.updated_at) : dateOnly(q.created_at);
      if (dateToCheck >= cutoff) all.push(q);
    }

    if (data.length < PAGE_SIZE) break;
    if (!filterOnUpdated) {
      const oldest = data[data.length - 1];
      if (dateOnly(oldest.created_at) < cutoff) break;
    }
    page++;
  }

  return all;
}

async function fetchQuotationDetail(id: string): Promise<TLQuotationDetail | null> {
  const resp = await apiCall<{ data?: TLQuotationDetail }>('/quotations.info', { id });
  return resp.data ?? null;
}

/** Fetch all relevant quotations; return rows + flat product lines for aggregation. */
export async function fetchQuotations(
  cutoff: string,
  customerLookup: Record<string, CustomerInfo>,
  priceConfig: PriceConfig,
): Promise<{ rows: QuotationRow[]; productLines: AggLine[] }> {
  const summaries: TLQuotationSummary[] = [
    ...(await fetchQuotationsByStatus('accepted', cutoff, true)),
    ...(await fetchQuotationsByStatus('open', cutoff, false)),
    ...(await fetchQuotationsByStatus('refused', cutoff, true)),
  ];

  const results = await mapLimit(summaries, FETCH_CONCURRENCY, async (q) => {
    try {
      const detail = await fetchQuotationDetail(q.id);
      return parseQuotation(q, detail, customerLookup, priceConfig);
    } catch {
      // Mirror the script: skip quotations whose detail fetch fails.
      return null;
    }
  });

  const rows: QuotationRow[] = [];
  const productLines: AggLine[] = [];
  for (const r of results) {
    if (!r) continue;
    rows.push(r.row);
    for (const l of r.lines) {
      productLines.push({ ...l, status: r.row.status, quotationId: r.row.id });
    }
  }

  return { rows, productLines };
}
