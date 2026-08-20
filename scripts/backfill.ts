// Backfill all Teamleader history into Supabase. One-time (or occasional).
// Run: `npm run backfill`. Can take several minutes (fetches every quotation's
// detail, rate-limited).
//
// Er kan er maar EEN tegelijk draaien, en dat wordt nu afgedwongen met een
// atomaire lock in de database (dezelfde die /api/sync gebruikt). Dat is geen
// netheid: het Teamleader-token roteert bij elke vernieuwing en de vorige wordt
// meteen ingetrokken, dus twee gelijktijdige processen breken de koppeling.
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { backfillAll } from '../lib/teamleader/backfill';

async function main() {
  const force = process.argv.includes('--force');
  if (force) {
    console.log('[backfill] --force: lock genegeerd. Doe dit alleen als je zeker weet dat er');
    console.log('[backfill]          niets anders met Teamleader praat (ook de cron niet).');
  }

  console.log('[backfill] start — dit haalt ALLE historie op en kan enkele minuten duren…');
  const t0 = Date.now();
  const r = await backfillAll(undefined, { force });
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`[backfill] klaar in ${secs}s: ${r.quotations} offertes, ${r.deals} deals, ${r.invoices} facturen opgeslagen in Supabase.`);
  if (r.skipped) {
    console.log(`[backfill] LET OP — verwijderde offertes niet gemarkeerd: ${r.skipped}`);
  }
  if (r.markedDeleted > 0) {
    console.log(`[backfill] ${r.markedDeleted} offerte(s) staan niet meer in Teamleader — gemarkeerd als verwijderd bij de bron (rij blijft bewaard, telt niet meer mee).`);
  }
  if (r.restored > 0) {
    console.log(`[backfill] ${r.restored} eerder verwijderde offerte(s) zijn weer opgedoken — markering weggehaald.`);
  }
  process.exit(0);
}

main().catch((e) => {
  const msg = e?.message || String(e);
  if (msg.startsWith('Er loopt al een synchronisatie')) {
    // Geen stacktrace: dit is een normale uitkomst, geen bug.
    console.error(`\n[backfill] AFGEBROKEN — ${msg}`);
    console.error('[backfill] Weet je zeker dat er niets draait? Dan: npm run backfill -- --force\n');
    process.exit(2);
  }
  console.error('[backfill] FAILED:', msg);
  process.exit(1);
});
