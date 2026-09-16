// Zet de GAQL-koppeling (de MCP-URL of het token uit GAQL_TOKEN in .env.local)
// in Supabase, zodat Vernieuwen en de cron op Vercel hem kunnen gebruiken
// zonder dat iemand daar een omgevingsvariabele hoeft te mogen zetten.
//   npm run ads:token
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { storeGaqlToken, fetchAdsReport } from '../lib/ads-sync';

async function main() {
  const token = (process.env.GAQL_TOKEN ?? '').trim();
  if (!token) throw new Error('GAQL_TOKEN staat niet in .env.local.');
  // Eerst bewijzen dat hij werkt, dan pas opslaan.
  const report = await fetchAdsReport(new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), new Date(Date.now() - 86400000).toISOString().slice(0, 10));
  console.log(`[ads] koppeling werkt: ${report.data.length} dagregels in een proefrapport`);
  await storeGaqlToken(token);
  console.log('[ads] koppeling opgeslagen in Supabase (app_settings.ads_gaql). Vernieuwen op productie haalt nu ook Google Ads op.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n[ads] MISLUKT:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
