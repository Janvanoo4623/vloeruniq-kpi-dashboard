// One-time seed: load the current price map + cost constants + token into
// Supabase. Prices/costs get an early effective_from so all historical
// quotations have a price. Run: `npm run seed:supabase` (add --force to reset).
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { supabase } from '../lib/supabase';
import { store } from '../lib/store';
import { DEFAULT_PRICE_MAP } from '../lib/teamleader/price-map';
import {
  LABOR_COST_PER_M2,
  PRIMER_COST_PER_M2,
  GLUE_COST_PER_M2,
  LEVELING_COST_PER_M2,
} from '../lib/teamleader/constants';

const EFFECTIVE_FROM = '2000-01-01';

async function count(table: string): Promise<number> {
  const { count } = await supabase().from(table).select('*', { count: 'exact', head: true });
  return count ?? 0;
}

async function main() {
  const sb = supabase();
  const force = process.argv.includes('--force');

  // ── product_prices ──
  if (!force && (await count('product_prices')) > 0) {
    console.log(`product_prices already seeded (${await count('product_prices')}) — skip (use --force)`);
  } else {
    if (force) await sb.from('product_prices').delete().neq('id', 0);
    const config = (await store.getConfig()) ?? DEFAULT_PRICE_MAP;
    const rows = config.map((e) => ({ code: e.match, price: e.price, effective_from: EFFECTIVE_FROM }));
    const { error } = await sb.from('product_prices').insert(rows);
    if (error) throw error;
    console.log(`seeded product_prices: ${rows.length} (source: ${(await store.getConfig()) ? 'imported config' : 'defaults'})`);
  }

  // ── cost_settings ──
  if (!force && (await count('cost_settings')) > 0) {
    console.log('cost_settings already seeded — skip');
  } else {
    if (force) await sb.from('cost_settings').delete().neq('id', 0);
    const costs = [
      { key: 'labor', value: LABOR_COST_PER_M2 },
      { key: 'primer', value: PRIMER_COST_PER_M2 },
      { key: 'glue', value: GLUE_COST_PER_M2 },
      { key: 'leveling', value: LEVELING_COST_PER_M2 },
    ].map((c) => ({ ...c, effective_from: EFFECTIVE_FROM }));
    const { error } = await sb.from('cost_settings').insert(costs);
    if (error) throw error;
    console.log(`seeded cost_settings: ${costs.length}`);
  }

  // ── token ──
  const { data: tok } = await sb.from('token').select('id').eq('id', 1).maybeSingle();
  if (tok && !force) {
    console.log('token already present in Supabase — skip');
  } else {
    const local = await store.getToken();
    if (local?.refreshToken) {
      const { error } = await sb.from('token').upsert({
        id: 1,
        refresh_token: local.refreshToken,
        access_token: local.accessToken ?? null,
        access_token_expires_at: local.accessTokenExpiresAt ?? null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      console.log(`seeded token from local store (len ${local.refreshToken.length})`);
    } else {
      console.log('WARN: no local token found (.data/token.json) — seed TEAMLEADER_REFRESH_TOKEN manually');
    }
  }

  console.log('\nSeed complete.');
  process.exit(0);
}

main().catch((e) => {
  console.error('SEED FAILED:', e?.message || e);
  process.exit(1);
});
