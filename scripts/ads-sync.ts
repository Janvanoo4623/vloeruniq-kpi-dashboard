// Google Ads → Supabase, handmatig — `npm run sync:ads`.
//
// De Vernieuwen-knop en de cron doen dit ook (lib/ads-sync.ts); dit script is er
// voor een langere terugblik en voor het importeren van een opgeslagen rapport.
//
//   npm run sync:ads                      laatste 90 dagen t/m gisteren
//   npm run sync:ads -- --days 400        verder terug
//   npm run sync:ads -- --from 2024-11-01 --to 2025-03-31
//   npm run sync:ads -- --from-json .data/ads/backfill.json
//
// Env (.env.local): GAQL_TOKEN (token van gaql.app), GOOGLE_ADS_CUSTOMER_ID.
// Raakt Teamleader niet aan en hoeft dus niet de sync-lock te claimen.
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { readFileSync } from 'node:fs';
import { fetchAdsReport, reportToRows, storeAdsRows, type AdsReport } from '../lib/ads-sync';
import { hasSupabase } from '../lib/supabase';
import type { AdsDailyRow } from '../lib/ads';

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().split('T')[0];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Een JSON-bestand met één rapport, een lijst rapporten, of een {result: rapport}-export. */
function readJson(path: string): { rows: AdsDailyRow[]; from: string; to: string } {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  const reports: AdsReport[] = Array.isArray(raw)
    ? (raw as AdsReport[])
    : raw && typeof raw === 'object' && 'columns' in (raw as object)
      ? [raw as AdsReport]
      : raw && typeof raw === 'object' && 'result' in (raw as object)
        ? [(raw as { result: AdsReport }).result]
        : [];
  if (reports.length === 0) throw new Error(`Geen rapport gevonden in ${path}`);
  const rows = reports.flatMap(reportToRows);
  const dates = rows.map((r) => r.date).sort();
  return { rows, from: dates[0], to: dates[dates.length - 1] };
}

async function main() {
  if (!hasSupabase()) throw new Error('SUPABASE_URL en de service-role key ontbreken in .env.local.');

  const jsonPath = arg('from-json');
  let rows: AdsDailyRow[];
  let from: string;
  let to: string;
  let source: 'gaql' | 'json';

  if (jsonPath) {
    ({ rows, from, to } = readJson(jsonPath));
    source = 'json';
    console.log(`[ads] import uit ${jsonPath}: ${rows.length} rijen, ${from} t/m ${to}`);
  } else {
    to = isDate(arg('to')) ? (arg('to') as string) : iso(Date.now() - DAY);
    const days = Number(arg('days') || 90);
    from = isDate(arg('from')) ? (arg('from') as string) : iso(Date.parse(to) - (days - 1) * DAY);
    source = 'gaql';
    console.log(`[ads] ophalen via GAQL.app: ${from} t/m ${to}`);
    rows = reportToRows(await fetchAdsReport(from, to));
    console.log(`[ads] ${rows.length} dagregels ontvangen`);
  }

  const r = await storeAdsRows(rows, from, to, source);
  const cost = rows.reduce((s, x) => s + x.cost, 0);
  console.log(`[ads] klaar: ${r.rows} rijen geschreven, ${r.stale} verouderde rijen verwijderd`);
  console.table({
    Periode: `${from} t/m ${to}`,
    'Kosten (€)': Math.round(cost * 100) / 100,
    Klikken: rows.reduce((s, x) => s + x.clicks, 0),
    Conversies: Math.round(rows.reduce((s, x) => s + x.conversions, 0) * 10) / 10,
    Campagnes: new Set(rows.map((x) => x.campaignId)).size,
  });
  process.exit(0);
}

main().catch((err) => {
  console.error('\n[ads] MISLUKT:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
