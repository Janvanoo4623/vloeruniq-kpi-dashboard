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
  // Standaard claimt deze run de lock, net als de cron. Tot 2026-09-15 gaf dit
  // script altijd force mee en sloeg het de lock dus over; samen met de cron van
  // twaalf uur trok Teamleader daardoor het refresh-token in. Wil je een blijven
  // hangen run overnemen, dan moet je dat voortaan expliciet zeggen.
  const force = process.argv.includes('--force');
  console.log(`[sync] backend=${store.backend()}  writeback=${writeback}`);
  if (!writeback) console.log('[sync] write-back to Teamleader is DISABLED for this run.');
  if (force) {
    console.log('[sync] --force: een lopende sync wordt overgenomen. Doe dit alleen als je');
    console.log('[sync]          zeker weet dat er niets anders draait — twee processen');
    console.log('[sync]          maken elkaars Teamleader-token ongeldig.');
  }

  const t0 = Date.now();
  const { snapshot, meta } = await syncAndStore({ force, owner: 'npm run sync' });
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
  const bericht = err instanceof Error ? err.message : String(err);
  console.error('\n[sync] MISLUKT:', bericht);
  if (bericht.startsWith('Er loopt al een synchronisatie')) {
    console.error('\n[sync] Weet je zeker dat er niets draait? Dan: npm run sync -- --force\n');
  }
  if (/refresh token is invalid|Token has been revoked/i.test(bericht)) {
    console.error(
      '\n[sync] Het Teamleader-refreshtoken is ingetrokken. Dat gebeurt zodra twee\n' +
        '[sync] processen het token verversen. Haal een nieuw token op met: npm run oauth\n',
    );
  }
  process.exit(1);
});
