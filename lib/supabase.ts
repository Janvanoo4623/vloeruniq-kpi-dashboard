// Supabase (Postgres) client — server-side only, uses the service-role key.
// Selected automatically when the env vars are present; otherwise the app falls
// back to the local file store (see lib/store.ts).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function url(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}
function serviceKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
}

export function hasSupabase(): boolean {
  return Boolean(url() && serviceKey());
}

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    const u = url();
    const k = serviceKey();
    if (!u || !k) {
      throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    }
    client = createClient(u, k, { auth: { persistSession: false } });
  }
  return client;
}
