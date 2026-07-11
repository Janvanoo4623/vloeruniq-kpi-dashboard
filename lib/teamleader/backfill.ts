// One-time backfill: fetch ALL Teamleader quotations + won deals (no 90-day
// cutoff) and upsert them into Supabase, so the dashboard can show long date
// ranges and trends. Does NOT push run-time back to Teamleader and does NOT
// touch the cached 90-day snapshot. Run via `npm run backfill` (no timeout).
import * as db from '../db';
import { buildCustomerLookup, fetchRunTime } from './deals';
import { fetchQuotations } from './quotations';
import { fetchInvoices } from './invoices';

const EPOCH = '2000-01-01';

export async function backfillAll(cutoff: string = EPOCH): Promise<{
  quotations: number;
  deals: number;
  invoices: number;
}> {
  const [priceRows, costRows] = await Promise.all([db.getPriceRows(), db.getCostRows()]);
  const customerLookup = await buildCustomerLookup();

  const { rows: quotations } = await fetchQuotations(cutoff, customerLookup, priceRows, costRows);
  // Backfill: no write-back (don't push doorlooptijd for all historical deals).
  const { rows: runTimeRows } = await fetchRunTime(cutoff, {}, false);
  const invoices = await fetchInvoices(cutoff);

  await db.upsertQuotations(quotations);
  await db.upsertDeals(runTimeRows);
  await db.upsertInvoices(invoices);

  return { quotations: quotations.length, deals: runTimeRows.length, invoices: invoices.length };
}
