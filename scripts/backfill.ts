// Backfill all Teamleader history into Supabase. One-time (or occasional).
// Run: `npm run backfill`. Can take several minutes (fetches every quotation's
// detail, rate-limited). Do not run at the same time as the production cron.
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { backfillAll } from '../lib/teamleader/backfill';

async function main() {
  console.log('[backfill] start — dit haalt ALLE historie op en kan enkele minuten duren…');
  const t0 = Date.now();
  const r = await backfillAll();
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`[backfill] klaar in ${secs}s: ${r.quotations} offertes, ${r.deals} deals opgeslagen in Supabase.`);
  process.exit(0);
}

main().catch((e) => {
  console.error('[backfill] FAILED:', e?.message || e);
  process.exit(1);
});
