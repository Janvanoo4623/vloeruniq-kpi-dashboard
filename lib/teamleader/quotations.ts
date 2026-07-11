// Fetch + parse quotations (accepted / open / refused) within the lookback window.
// Mirrors fetchRevenue + fetchAllQuotations + parseQuotation from the script.
import { apiCall, mapLimit } from './client';
import { dateOnly } from './dates';
import { parseQuotation } from './matching';
import {
  FETCH_CONCURRENCY,
  PAGE_SIZE,
  LABOR_COST_PER_M2,
  PRIMER_COST_PER_M2,
  GLUE_COST_PER_M2,
  LEVELING_COST_PER_M2,
} from './constants';
import { priceConfigForDate, resolveCost, type PriceRow, type CostRow } from '../pricing';
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

/**
 * Fetch all relevant quotations; return rows + flat product lines. Prices/costs
 * are resolved per quotation's date (date-effective), so a price edit never
 * changes older quotations. See lib/pricing.ts.
 */
export async function fetchQuotations(
  cutoff: string,
  customerLookup: Record<string, CustomerInfo>,
  priceRows: PriceRow[],
  costRows: CostRow[],
): Promise<{ rows: QuotationRow[]; productLines: AggLine[] }> {
  const summaries: TLQuotationSummary[] = [
    ...(await fetchQuotationsByStatus('accepted', cutoff, true)),
    ...(await fetchQuotationsByStatus('open', cutoff, false)),
    ...(await fetchQuotationsByStatus('refused', cutoff, true)),
  ];

  const today = new Date().toISOString().split('T')[0];

  // Cost keys applied only to glued PVC; everything else (labor + custom extras)
  // applies to every matched floor m².
  const GLUED_KEYS = new Set(['primer', 'glue', 'leveling']);
  const FALLBACK: Record<string, number> = {
    labor: LABOR_COST_PER_M2,
    primer: PRIMER_COST_PER_M2,
    glue: GLUE_COST_PER_M2,
    leveling: LEVELING_COST_PER_M2,
  };
  const costKeys = [...new Set(costRows.map((r) => r.key))];

  const results = await mapLimit(summaries, FETCH_CONCURRENCY, async (q) => {
    try {
      const detail = await fetchQuotationDetail(q.id);
      const date = dateOnly(q.created_at) || dateOnly(q.updated_at) || today;
      const priceConfig = priceConfigForDate(priceRows, date);

      let alwaysPerM2 = 0;
      let gluedPerM2 = 0;
      for (const key of costKeys) {
        const v = resolveCost(costRows, key, date, FALLBACK[key] ?? 0);
        if (GLUED_KEYS.has(key)) gluedPerM2 += v;
        else alwaysPerM2 += v;
      }

      return parseQuotation(q, detail, customerLookup, priceConfig, { alwaysPerM2, gluedPerM2 });
    } catch {
      // Mirror the script: skip quotations whose detail fetch fails.
      return null;
    }
  });

  const rows: QuotationRow[] = [];
  const productLines: AggLine[] = [];
  for (const row of results) {
    if (!row) continue;
    rows.push(row);
    for (const l of row.lines ?? []) {
      productLines.push({ ...l, status: row.status, quotationId: row.id });
    }
  }

  return { rows, productLines };
}
