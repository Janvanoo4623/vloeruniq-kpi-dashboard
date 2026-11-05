// Supabase (Postgres) client — server-side only, uses the service-role key.
// Selected automatically when the env vars are present; otherwise the app falls
// back to the local file store (see lib/store.ts).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function url(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}
function serviceKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_KEY
  );
}

export function hasSupabase(): boolean {
  return Boolean(url() && serviceKey());
}

/**
 * fetch met herhaalpoging bij een netwerkfout ("TypeError: fetch failed"). Twee
 * backfills op 2026-11-05 liepen daarop stuk, telkens bij de eerste schrijfactie
 * na minuten waarin alleen Teamleader werd aangesproken: een verbinding die
 * intussen dicht was. Alleen gegooide fouten worden herhaald, nooit een
 * HTTP-antwoord, en alles wat we schrijven is een upsert of een
 * voorwaardelijke update — opnieuw sturen is dus veilig.
 */
const retryingFetch: typeof fetch = async (input, init) => {
  const pogingen = 3;
  for (let i = 1; ; i++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      if (i >= pogingen || init?.signal?.aborted) throw err;
      await new Promise((r) => setTimeout(r, 1000 * i * i));
    }
  }
};

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    const u = url();
    const k = serviceKey();
    if (!u || !k) {
      throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    }
    client = createClient(u, k, { auth: { persistSession: false }, global: { fetch: retryingFetch } });
  }
  return client;
}
