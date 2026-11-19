import { createHash } from 'node:crypto';
import { getAppSetting } from './db';
import { hasSupabase } from './supabase';

/** Hash van de planning-sleutel; alleen de hash staat in Supabase. */
export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

/**
 * De sleutel staat als PLANNING_API_SECRET in de omgeving, óf als sha256-hash in
 * Supabase (app_settings.planning_api, gezet met `npm run planning:token`). Dat
 * tweede bestaat omdat Jasper geen omgevingsvariabelen op Vercel productie kan
 * zetten — hetzelfde patroon als de Moneybird- en Ads-koppeling.
 */
export async function authorized(request: Request): Promise<boolean> {
  const header = request.headers.get('authorization') ?? '';
  const given = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const env = process.env.PLANNING_API_SECRET;
  if (env) return given === env;
  const stored = hasSupabase() ? await getAppSetting<{ sha256?: string } | null>('planning_api', null) : null;
  if (stored?.sha256) return given !== '' && sha256(given) === stored.sha256;
  return process.env.NODE_ENV !== 'production'; // alleen lokaal zonder sleutel
}

