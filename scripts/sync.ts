// Local sync runner — `npm run sync`. Runs the full Teamleader pipeline without
// serverless time limits and writes the snapshot to the datastore (.data/ locally).
import { loadEnvConfig } from '@next/env';

// Load .env.local the same way Next does (lib modules read process.env lazily,
// so this runs before any of them are invoked).
loadEnvConfig(process.cwd());

import { store } from '../lib/store';
import { syncAndStore } from '../lib/teamleader/sync';

async function main() {
  const writeback = process.env.TEAMLEADER_WRITEBACK !== 'false';
  console.log(`[sync] backend=${store.backend()}  writeback=${writeback}`);
  if (!writeback) console.log('[sync] write-back to Teamleader is DISABLED for this run.');

  const t0 = Date.now();
  const { snapshot, meta } = await syncAndStore({ force: true });
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);

  const r = snapshot.revenue.totals;
  console.log(`\n[sync] completed in ${seconds}s\n`);
  console.table({
    'Revenue Accepted (€)': r.acceptedRevenue,
    'Revenue Open (€)': r.openRevenue,
    '# Quotations Accepted': r.acceptedCount,
    '# Quotations Open': r.openCount,
    '# Quotations Refused': r.refusedCount,
    'Conversion Rate (%)': r.conversionPct,
    'Avg Revenue / Deal (€)': r.avgRevenuePerDeal,
    'M² Sold': r.m2Sold,
    'Total Margin (€)': r.totalMargin,
    'Avg Margin (%)': r.avgMarginPct,
    'Avg Run Time (days)': snapshot.runTime.totals.avgRunTimeDays,
    '# Deals Tracked': snapshot.runTime.totals.dealsTracked,
  });

  console.log('\nRevenue per lead source:');
  console.table(snapshot.leadSources);

  console.log(`\nPushed to Teamleader: ${meta.counts?.pushedToTeamleader ?? 0}`);
  console.log(`Snapshot weeks: ${snapshot.weeks.length}  |  Quotations: ${snapshot.quotations.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('\n[sync] FAILED:', err);
  process.exit(1);
});
