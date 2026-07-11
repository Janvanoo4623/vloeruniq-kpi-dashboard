// Import extra product prices (TSV: code<tab>price) into Supabase product_prices,
// effective from the epoch so all historical quotations get a price. Skips codes
// that already have a price. Run: `npm run import:prices [file] [--force]`.
// Paste the product + price columns from the sheet tabs into prices2.tsv first.
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { supabase } from '../lib/supabase';

const EFFECTIVE_FROM = '2000-01-01';

function parsePrice(raw: string): number | null {
  let s = raw.replace(/[€\s]/g, '').trim();
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function splitColumns(line: string): [string, string] | null {
  let parts = line.includes('\t') ? line.split('\t') : line.split(';');
  if (parts.length < 2) parts = line.split(/\s{2,}/);
  if (parts.length < 2) return null;
  return [parts[0].trim(), parts.slice(1).join(' ').trim()];
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const file = args.find((a) => !a.startsWith('--')) || 'prices2.tsv';
  const full = path.resolve(process.cwd(), file);

  let text: string;
  try {
    text = await fs.readFile(full, 'utf8');
  } catch {
    console.error(`Kon ${full} niet lezen. Plak de kolommen in prices2.tsv.`);
    process.exit(1);
  }

  const parsed: { code: string; price: number }[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols = splitColumns(line);
    if (!cols) continue;
    const [code, priceRaw] = cols;
    const price = parsePrice(priceRaw);
    if (!code || price === null || /inkoop|product|prijs|p-nummer/i.test(code)) {
      skipped++;
      continue;
    }
    parsed.push({ code, price });
  }

  if (parsed.length === 0) {
    console.error('Geen geldige regels gevonden (verwacht: code<tab>prijs).');
    process.exit(1);
  }

  // Skip codes that already have a price (case-insensitive), unless --force.
  const { data: existing } = await supabase().from('product_prices').select('code');
  const have = new Set((existing ?? []).map((r) => String(r.code).toLowerCase()));

  const toInsert = parsed.filter((p) => force || !have.has(p.code.toLowerCase()));
  const dupes = parsed.length - toInsert.length;

  if (toInsert.length > 0) {
    const rows = toInsert.map((p) => ({ code: p.code, price: p.price, effective_from: EFFECTIVE_FROM }));
    const { error } = await supabase().from('product_prices').insert(rows);
    if (error) throw error;
  }

  console.log(`Ingelezen: ${parsed.length} regels (${skipped} overgeslagen als header/leeg).`);
  console.log(`Toegevoegd: ${toInsert.length} nieuwe prijzen. Al aanwezig (overgeslagen): ${dupes}.`);
  console.log(toInsert.slice(0, 5).map((p) => `${p.code}=${p.price}`).join('  '));
  console.log('\nKlaar. Nieuwe/gewijzigde marges worden zichtbaar na de volgende sync.');
  process.exit(0);
}

main().catch((e) => {
  console.error('IMPORT FAILED:', e?.message || e);
  process.exit(1);
});
