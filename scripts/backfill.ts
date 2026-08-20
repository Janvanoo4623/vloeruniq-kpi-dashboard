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
  console.log(`[backfill] klaar in ${secs}s: ${r.quotations} offertes, ${r.deals} deals, ${r.invoices} facturen opgeslagen in Supabase.`);
  if (r.markedDeleted > 0) {
    console.log(`[backfill] ${r.markedDeleted} offerte(s) staan niet meer in Teamleader — gemarkeerd als verwijderd bij de bron (rij blijft bewaard, telt niet meer mee).`);
  }
  if (r.skipped) {
    console.log(`[backfill] LET OP — verwijderde offertes niet gemarkeerd: ${r.skipped}`);
  }
  if (r.restored > 0) {
    console.log(`[backfill] ${r.restored} eerder verwijderde offerte(s) zijn weer opgedoken — markering weggehaald.`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('[backfill] FAILED:', e?.message || e);
  process.exit(1);
});
