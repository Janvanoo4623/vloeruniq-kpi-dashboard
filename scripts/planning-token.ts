// Maakt de sleutel waarmee n8n POST /api/planning aanroept.
//   npm run planning:token
//
// - Nieuwe willekeurige sleutel → PLANNING_API_SECRET in .env.local (voor lokaal
//   testen en om hem in n8n te plakken).
// - Alleen de sha256-hash gaat naar Supabase (app_settings.planning_api); daar
//   leest productie hem. Zo hoeft niemand een omgevingsvariabele op Vercel te zetten.
// De sleutel zelf wordt NIET afgedrukt: kopieer hem uit .env.local naar de n8n-credential.
// Opnieuw draaien maakt een nieuwe sleutel en maakt de oude ongeldig.
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { setAppSetting } from '../lib/db';
import { sha256 } from '../lib/planning-token';

async function main() {
  const secret = randomBytes(32).toString('hex');
  await setAppSetting('planning_api', { sha256: sha256(secret), created: new Date().toISOString() });
  const path = '.env.local';
  const env = readFileSync(path, 'utf8');
  const line = `PLANNING_API_SECRET=${secret}`;
  writeFileSync(
    path,
    /^PLANNING_API_SECRET=.*$/m.test(env) ? env.replace(/^PLANNING_API_SECRET=.*$/m, line) : `${env.trimEnd()}\n${line}\n`,
  );
  console.log('[planning] nieuwe sleutel: hash in Supabase (app_settings.planning_api), sleutel in .env.local (PLANNING_API_SECRET).');
}

main().catch((err) => {
  console.error('[planning] MISLUKT:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
