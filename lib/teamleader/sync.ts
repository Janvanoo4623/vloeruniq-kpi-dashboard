// Pipeline orchestrator: token -> fetch -> match -> run-time -> aggregate ->
// snapshot. `syncAndStore` wraps it with meta/locking and persists the result.
// Mirrors runAll. See docs/ARCHITECTURE.md.
import { store } from '../store';
import type { Snapshot, SyncMeta } from '../types';
import { DAYS_LOOKBACK } from './constants';
import { getCutoffDate } from './dates';
import { buildPriceConfig, DEFAULT_PRICE_MAP } from './price-map';
import { buildCustomerLookup, fetchRunTime } from './deals';
import { fetchQuotations } from './quotations';
import { fetchInvoicing } from './invoices';
import { buildSnapshot } from './aggregate';

const STALE_LOCK_MS = 15 * 60 * 1000;

/** Run the full pipeline and return the computed snapshot (no persistence). */
export async function runSync(): Promise<{ snapshot: Snapshot; pushed: number }> {
  const cutoff = getCutoffDate();

  const config = (await store.getConfig()) ?? DEFAULT_PRICE_MAP;
  const priceConfig = buildPriceConfig(config);

  const customerLookup = await buildCustomerLookup();
  const { rows: quotations, productLines } = await fetchQuotations(cutoff, customerLookup, priceConfig);
  const invoicing = await fetchInvoicing(cutoff);

  // Prior execution dates drive write-back change detection.
  const prevSnapshot = await store.getSnapshot();
  const prevExecution: Record<string, string> = {};
  for (const r of prevSnapshot?.runTimeRows ?? []) prevExecution[r.dealId] = r.dateExecution;

  const writeback = process.env.TEAMLEADER_WRITEBACK !== 'false';
  const { rows: runTimeRows, pushed } = await fetchRunTime(cutoff, prevExecution, writeback);

  const generatedAt = new Date().toISOString();
  const snapshot = buildSnapshot(
    quotations,
    runTimeRows,
    productLines,
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
  const existing = await store.getMeta();

  if (!force && existing?.status === 'running' && existing.startedAt) {
    const age = Date.now() - Date.parse(existing.startedAt);
    if (age < STALE_LOCK_MS) {
      throw new Error('A sync is already running.');
    }
  }

  const startIso = new Date().toISOString();
  const start = Date.now();
  await store.setMeta({
    status: 'running',
    startedAt: startIso,
    lastSyncAt: existing?.lastSyncAt ?? null,
    durationMs: null,
    counts: null,
    error: null,
  });

  try {
    const { snapshot, pushed } = await runSync();
    await store.setSnapshot(snapshot);

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
    await store.setMeta(meta);
    return { snapshot, meta };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const meta: SyncMeta = {
      status: 'error',
      startedAt: startIso,
      lastSyncAt: existing?.lastSyncAt ?? null,
      durationMs: Date.now() - start,
      counts: null,
      error: message,
    };
    await store.setMeta(meta);
    throw err;
  }
}
