// Zet de Moneybird-koppeling (MONEYBIRD_TOKEN uit .env.local) in Supabase, na een
// proefrapport. Daarna halen Vernieuwen en de cron op Vercel Moneybird mee,
// zonder dat iemand daar een omgevingsvariabele hoeft te mogen zetten.
//   npm run moneybird:token
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { fetchMoneybirdPL, getMoneybirdConfig, storeMoneybirdConfig, syncMoneybird } from '../lib/moneybird';

async function main() {
  const token = (process.env.MONEYBIRD_TOKEN ?? '').trim();
  if (!token) throw new Error('MONEYBIRD_TOKEN staat niet in .env.local.');
  const cfg = (await getMoneybirdConfig())!;
  // Eerst bewijzen dat hij werkt (dat levert ook het administratienummer), dan pas opslaan.
  const pl = await fetchMoneybirdPL(cfg);
  const adminId = cfg.administrationId || (await (await fetch('https://moneybird.com/api/v2/administrations.json', { headers: { Authorization: `Bearer ${token}` } })).json())[0]?.id;
  console.log(`[moneybird] koppeling werkt: ${pl.administrationName}, ${pl.accounts.length} grootboekrekeningen, ${pl.months.length} maanden`);
  await storeMoneybirdConfig({ token, administrationId: adminId });
  console.log('[moneybird] koppeling opgeslagen in Supabase (app_settings.moneybird).');
  const r = await syncMoneybird();
  console.log(r.ok ? `[moneybird] ${r.months} maanden geladen` : `[moneybird] laden mislukt: ${r.error}`);
  process.exit(r.ok ? 0 : 1);
}

main().catch((err) => {
  console.error('\n[moneybird] MISLUKT:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
