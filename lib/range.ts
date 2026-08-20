// Aggregate stored quotations/deals into a Snapshot for an arbitrary date range.
// Reuses the pure buildSnapshot (weekly aggregation) — we just feed it the
// range-filtered rows. Used by /api/data for the date selector + comparison.
import { buildSnapshot } from './teamleader/aggregate';
import type { AggLine } from './teamleader/quotations';
import type { InvoicingSummary, QuotationRow, RunTimeRow, Snapshot } from './types';

/**
 * De datum waarop een offerte in een periode valt: de beslisdatum als hij er is,
 * anders de aanmaakdatum. Deze regel staat identiek in aggregate.ts en series.ts —
 * lopen filteren en bucketen uiteen, dan verschijnen er weken in de grafiek die
 * buiten de gekozen periode liggen.
 */
function relevantDate(q: QuotationRow): string {
  return q.status !== 'open' && q.dateAccepted ? q.dateAccepted : q.dateCreated;
}

export function snapshotForRange(
  quotations: QuotationRow[],
  deals: RunTimeRow[],
  from: string,
  to: string,
  exclusions: Set<string>,
  invoicing: InvoicingSummary,
  generatedAt: string,
): Snapshot {
  const q = quotations.filter((x) => {
    if (exclusions.has(x.id)) return false;
    const d = relevantDate(x);
    return d >= from && d <= to;
  });
  const d = deals.filter((x) => x.dateAccepted >= from && x.dateAccepted <= to);
  const lines: AggLine[] = q.flatMap((x) =>
    (x.lines ?? []).map((l) => ({ ...l, status: x.status, quotationId: x.id })),
  );
  const days = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1);
  return buildSnapshot(q, d, lines, invoicing, days, generatedAt);
}
