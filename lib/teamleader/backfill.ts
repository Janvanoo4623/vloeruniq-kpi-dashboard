// One-time backfill: fetch ALL Teamleader quotations + won deals (no 90-day
// cutoff) and upsert them into Supabase, so the dashboard can show long date
// ranges and trends. Does NOT push run-time back to Teamleader and does NOT
// touch the cached 90-day snapshot. Run via `npm run backfill` (no timeout).
import * as db from '../db';
import { buildCustomerLookup, fetchRunTime } from './deals';
import { fetchQuotations } from './quotations';
import { fetchInvoices } from './invoices';

const EPOCH = '2000-01-01';

export async function backfillAll(
  cutoff: string = EPOCH,
  { force = false }: { force?: boolean } = {},
): Promise<{
  quotations: number;
  deals: number;
  invoices: number;
  markedDeleted: number;
  restored: number;
  skipped?: string;
}> {
  // Dezelfde lock als de gewone sync. Een backfill duurt ~10 minuten en praat
  // die hele tijd met Teamleader; loopt de cron er tegelijk doorheen, dan
  // verversen ze allebei de refresh token en trekken ze elkaars token in.
  if (!force) {
    const lock = await db.acquireSyncLock('backfill');
    if (!lock.ok) throw new Error(db.lockBusyMessage(lock));
  }

  try {
    return await runBackfill(cutoff);
  } finally {
    await db.releaseSyncLock();
  }
}

async function runBackfill(cutoff: string): Promise<{
  quotations: number;
  deals: number;
  invoices: number;
  markedDeleted: number;
  restored: number;
  skipped?: string;
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

  // De backfill haalt ALLE statussen zonder datumgrens op, dus wat hier niet in
  // zit bestaat niet meer in Teamleader. Alleen hier is die conclusie geldig.
  const { marked, restored, skipped } = await db.markDeletedAtSource(
    new Set(quotations.map((q) => q.id)),
  );

  return {
    quotations: quotations.length,
    deals: runTimeRows.length,
    invoices: invoices.length,
    markedDeleted: marked,
    restored,
    skipped,
  };
}
