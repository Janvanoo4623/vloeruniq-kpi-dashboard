// Zet de Meta-koppeling (META_ACCESS_TOKEN + META_AD_ACCOUNT_ID uit .env.local)
// in Supabase, na een proefrapport. Daarna haalt Vernieuwen Meta mee.
//   npm run ads:meta-token
//   npm run ads:meta-token -- --days 400     ook meteen de historie laden
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { fetchMetaRows, storeMetaConfig, syncMetaAds } from '../lib/meta-ads-sync';

async function main() {
  const token = (process.env.META_ACCESS_TOKEN ?? '').trim();
  const accountId = (process.env.META_AD_ACCOUNT_ID ?? '').trim().replace(/^act_/, '');
  if (!token || !accountId) throw new Error('META_ACCESS_TOKEN en META_AD_ACCOUNT_ID moeten in .env.local staan.');
  const cfg = { token, accountId };
  const to = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const rows = await fetchMetaRows(cfg, from, to);
  console.log(`[meta] koppeling werkt: ${rows.length} dagregels in een proefrapport (${from} t/m ${to})`);
  await storeMetaConfig(cfg);
  console.log('[meta] koppeling opgeslagen in Supabase (app_settings.ads_meta).');
  const i = process.argv.indexOf('--days');
  const days = i >= 0 ? Number(process.argv[i + 1]) : 90;
  const r = await syncMetaAds({ days });
  console.log(r.ok ? `[meta] ${r.rows} dagregels geladen over ${days} dagen` : `[meta] laden mislukt: ${r.error}`);
  process.exit(r.ok ? 0 : 1);
}

main().catch((err) => {
  console.error('\n[meta] MISLUKT:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
