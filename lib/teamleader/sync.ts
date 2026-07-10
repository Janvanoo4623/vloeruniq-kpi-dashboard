// Pipeline orchestrator (v2, Supabase): token -> fetch -> date-effective match
// -> run-time -> upsert raw quotations/deals -> aggregate -> cache snapshot.
// See docs/ARCHITECTURE.md + docs/SUPABASE.md.
import * as db from '../db';
import type { Snapshot, SyncMeta } from '../types';
import { DAYS_LOOKBACK } from './constants';
import { getCutoffDate } from './dates';
import { buildCustomerLookup, fetchRunTime } from './deals';
import { fetchQuotations } from './quotations';
import { fetchInvoicing } from './invoices';
import { buildSnapshot } from './aggregate';

const STALE_LOCK_MS = 15 * 60 * 1000;

/** Run the full pipeline and return the computed snapshot (persists raw rows). */
export async function runSync(): Promise<{ snapshot: Snapshot; pushed: number }> {
  const cutoff = getCutoffDate();

  const [priceRows, costRows] = await Promise.all([db.getPriceRows(), db.getCostRows()]);
  const customerLookup = await buildCustomerLookup();
  const { rows: quotations, productLines } = await fetchQuotations(
    cutoff,
    customerLookup,
    priceRows,
    costRows,
  );
  const invoicing = await fetchInvoicing(cutoff);

  // Prior execution dates (from the cached snapshot) drive write-back detection.
  const prevSnapshot = await db.getSnapshot();
  const prevExecution: Record<string, string> = {};
  for (const r of prevSnapshot?.runTimeRows ?? []) prevExecution[r.dealId] = r.dateExecution;

  const writeback = process.env.TEAMLEADER_WRITEBACK !== 'false';
  const { rows: runTimeRows, pushed } = await fetchRunTime(cutoff, prevExecution, writeback);

  // Persist raw rows (accumulate history for date ranges / trends).
  await db.upsertQuotations(quotations);
  await db.upsertDeals(runTimeRows);

  // Build the snapshot for the window, excluding excluded quotation IDs.
  const exclusions = await db.getExclusions();
  const visibleQuotations = quotations.filter((q) => !exclusions.has(q.id));
  const visibleLines = productLines.filter((l) => !exclusions.has(l.quotationId));

  const generatedAt = new Date().toISOString();
  const snapshot = buildSnapshot(
    visibleQuotations,
    runTimeRows,
    visibleLines,
    invoicing,
    DAYS_LOOKBACK,
    generatedAt,
  );
  return { snapshot, pushed };
}

/** Run the pipeline with locking + meta tracking, persisting snapshot and meta. */
export async function syncAndStore(
  { force = false }: { force?: boolean } = {},
): Promise<{ snapshot: Snapshot; meta: SyncMeta }> {
  const existing = await db.getMeta();

  if (!force && existing?.status === 'running' && existing.startedAt) {
    const age = Date.now() - Date.parse(existing.startedAt);
    if (age < STALE_LOCK_MS) throw new Error('A sync is already running.');
  }

  const startIso = new Date().toISOString();
  const start = Date.now();
  await db.setMeta({
    status: 'running',
    startedAt: startIso,
    lastSyncAt: existing?.lastSyncAt ?? null,
    durationMs: null,
    counts: null,
    error: null,
  });

  try {
    const { snapshot, pushed } = await runSync();
    await db.setSnapshot(snapshot);

    const meta: SyncMeta = {
      status: 'ok',
      startedAt: startIso,
      lastSyncAt: snapshot.generatedAt,
      durationMs: Date.now() - start,
      counts: {
        quotations: snapshot.quotations.length,
        runTime: snapshot.runTimeRows.length,
        pushedToTeamleader: pushed,
      },
      error: null,
    };
    await db.setMeta(meta);
    return { snapshot, meta };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.setMeta({
      status: 'error',
      startedAt: startIso,
      lastSyncAt: existing?.lastSyncAt ?? null,
      durationMs: Date.now() - start,
      counts: null,
      error: message,
    });
    throw err;
  }
}
