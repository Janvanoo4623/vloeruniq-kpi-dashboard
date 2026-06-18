// Import the Config (price map) from the Google Sheet into the datastore, so
// margins match the Sheet exactly. The app's sync then uses these prices instead
// of the built-in defaults.
//
// Usage:
//   1. In the Sheet's "Config" tab, select both columns (Match + Inkoopprijs),
//      copy, and paste into a file named `config.tsv` in the project root.
//      (Copying from Google Sheets gives tab-separated values.)
//   2. Run: npm run import:config
//
// Accepts an optional path arg: npm run import:config -- path/to/file.tsv
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { store } from '../lib/store';
import type { PriceMapEntry } from '../lib/types';

/** Parse a Dutch-formatted price like "€ 11,50" or "10.85" -> number. */
function parsePrice(raw: string): number | null {
  let s = raw.replace(/[€\s]/g, '').trim();
  if (!s) return null;
  // If both separators present, assume "." thousands + "," decimal.
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.'); // single comma = decimal
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function splitColumns(line: string): [string, string] | null {
  // Prefer tab; fall back to the last whitespace gap or a semicolon.
  let parts = line.includes('\t') ? line.split('\t') : line.split(';');
  if (parts.length < 2) {
    // Last resort: split on 2+ spaces.
    parts = line.split(/\s{2,}/);
  }
  if (parts.length < 2) return null;
  const match = parts[0].trim();
  const price = parts.slice(1).join(' ').trim();
  return [match, price];
}

async function main() {
  const file = process.argv[2] || 'config.tsv';
  const full = path.resolve(process.cwd(), file);

  let text: string;
  try {
    text = await fs.readFile(full, 'utf8');
  } catch {
    console.error(`[import:config] Could not read ${full}`);
    console.error('Create it by pasting the Config tab (both columns) into config.tsv. See the script header.');
    process.exit(1);
  }

  const entries: PriceMapEntry[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols = splitColumns(line);
    if (!cols) continue;
    const [match, priceRaw] = cols;
    // Skip header / note rows.
    if (/inkoop|match|p-nummer|prijs/i.test(match) && parsePrice(priceRaw) === null) {
      skipped++;
      continue;
    }
    const price = parsePrice(priceRaw);
    if (!match || price === null) {
      skipped++;
      continue;
    }
    entries.push({ match, price });
  }

  if (entries.length === 0) {
    console.error('[import:config] No valid rows parsed. Is the file tab-separated with Match + price columns?');
    process.exit(1);
  }

  await store.setConfig(entries);
  console.log(`[import:config] backend=${store.backend()} — stored ${entries.length} price entries (skipped ${skipped}).`);
  console.log('  Sample:', entries.slice(0, 3).map((e) => `${e.match}=${e.price}`).join('  '));
  console.log('Now run `npm run sync` to recompute margins with these prices.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
