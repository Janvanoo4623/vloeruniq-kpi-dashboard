// Pipeline orchestrator (v2, Supabase): token -> fetch -> date-effective match
// -> run-time -> upsert raw quotations/deals -> aggregate -> cache snapshot.
// See docs/ARCHITECTURE.md + docs/SUPABASE.md.
import * as db from '../db';
import type { Snapshot, SyncMeta } from '../types';
import { DAYS_LOOKBACK } from './constants';
import { getCutoffDate } from './dates';
import { buildCustomerLookup, fetchRunTime } from './deals';
import { fetchQuotations } from './quotations';
import { fetchInvoices, summarizeInvoices } from './invoices';
import { buildSnapshot } from './aggregate';
import { computeQuality, mergeHistory, toSnapshot, type QualitySnapshot } from '../data-quality';

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
  const invoices = await fetchInvoices(cutoff);
  await db.upsertInvoices(invoices);
  const invoicing = summarizeInvoices(invoices);

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
  { force = false, owner = 'sync' }: { force?: boolean; owner?: string } = {},
): Promise<{ snapshot: Snapshot; meta: SyncMeta }> {
  const existing = await db.getMeta();

  // De lock is atomair (één UPDATE met de voorwaarde erin), dus van twee
  // gelijktijdige pogingen slaagt er precies één. Dat moet ook, want twee
  // processen die tegelijk het Teamleader-token verversen maken elkaars token
  // ongeldig — zie db.acquireSyncLock.
  if (!force) {
    const lock = await db.acquireSyncLock(owner);
    if (!lock.ok) throw new Error(db.lockBusyMessage(lock));
  }

  const startIso = new Date().toISOString();
  const start = Date.now();
  if (force) {
    await db.setMeta({
      status: 'running',
      startedAt: startIso,
      lastSyncAt: existing?.lastSyncAt ?? null,
      durationMs: null,
      counts: null,
      error: null,
    });
  }

  try {
    const { snapshot, pushed } = await runSync();
    await db.setSnapshot(snapshot);
    await recordQuality();

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

/**
 * Meet de datakwaliteit en bewaar hem. Hier en niet in de UI: dan ontstaat de
 * reeks vanzelf en hoeft niemand eraan te denken. Faalt dit, dan mag de sync er
 * niet op stuklopen — het is een meting, geen onderdeel van de pijplijn.
 */
async function recordQuality(): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [quotations, deals, invoices, priceRows, prices, overrides] = await Promise.all([
      db.getAllQuotations(),
      db.getAllDeals(),
      db.getAllInvoices(),
      db.getPriceRows(),
      db.getCurrentPrices(),
      db.getOverrides(),
    ]);
    const { applyOverrides } = await import('../overrides');
    const resolved = applyOverrides(quotations, overrides);
    const pricedCodes = new Set(prices.map((p) => p.code.toLowerCase()));
    const report = computeQuality(resolved, deals, invoices, priceRows, pricedCodes, today);

    const history = await db.getAppSetting<QualitySnapshot[]>('quality_history', []);
    await db.setAppSetting('quality_history', mergeHistory(history, toSnapshot(report, today)));
  } catch (err) {
    console.warn('[sync] datakwaliteit niet vastgelegd:', err instanceof Error ? err.message : err);
  }
}
