// Meta Ads (Facebook/Instagram) → Supabase, server-side. Zelfde patroon als
// lib/ads-sync.ts voor Google: dagcijfers per campagne, laatste 90 dagen t/m
// gisteren, bij Vernieuwen en de cron, zonder Teamleader-lock.
//
// Bron: de Marketing API (Graph API), endpoint
//   GET /v21.0/act_<account>/insights?level=campaign&time_increment=1
// met een systeemgebruiker-token uit de Business Manager van Vloeruniq
// (verloopt niet, rechten: ads_read). Kosten in accountvaluta (EUR).
//
// "Conversies" bij Meta zijn contactmomenten: leads, berichten, contact,
// afspraak, aanvraag — zie CONVERSION_GROUPS. Welke er echt voorkomen hangt af
// van hoe de campagnes zijn opgezet; na de eerste echte import controleren, en
// zo nodig een eigen lijst in app_settings.ads_meta.conversionActions zetten.
import { upsertAdsRows, deleteStaleAdsRows, setAdsMeta, getAdsMeta, getAppSetting, setAppSetting, type AdsMeta } from './db';
import type { AdsDailyRow } from './ads';

const GRAPH = 'https://graph.facebook.com/v21.0';
const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().split('T')[0];

/**
 * Wat als 'conversie' telt. Meta meldt hetzelfde contactmoment onder meerdere
 * namen tegelijk — een lead via een formulier staat er als `lead` én als
 * `onsite_conversion.lead_grouped` — dus zomaar optellen telt dubbel (in de
 * test werden 3 leads er 6). Per soort nemen we daarom de eerste naam die in
 * het antwoord voorkomt, en tellen we alleen de soorten bij elkaar op.
 */
export const CONVERSION_GROUPS: { label: string; types: string[] }[] = [
  { label: 'leads', types: ['lead', 'onsite_conversion.lead_grouped', 'leadgen_grouped', 'offsite_conversion.fb_pixel_lead'] },
  { label: 'berichten', types: ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply'] },
  { label: 'contact', types: ['contact_total', 'contact', 'offsite_conversion.fb_pixel_contact'] },
  { label: 'afspraak', types: ['schedule_total', 'schedule'] },
  { label: 'aanvraag', types: ['submit_application_total', 'submit_application'] },
];

type Action = { action_type: string; value: string };

/** Conversies uit een actions-lijst, zonder dubbeltellingen. Eigen lijst in de config: gewoon optellen. */
export function countConversions(actions: Action[] | undefined, custom?: string[]): number {
  const list = actions ?? [];
  if (custom?.length) {
    const set = new Set(custom);
    return list.filter((a) => set.has(a.action_type)).reduce((sum, a) => sum + Number(a.value || 0), 0);
  }
  const byType = new Map(list.map((a) => [a.action_type, Number(a.value || 0)]));
  let total = 0;
  for (const g of CONVERSION_GROUPS) {
    const hit = g.types.find((t) => byType.has(t));
    if (hit) total += byType.get(hit) ?? 0;
  }
  return total;
}

export interface MetaConfig {
  token: string;
  accountId: string; // zonder 'act_'
  conversionActions?: string[];
}

const META_KEY = 'ads_meta';

/** Eerst de env (lokaal), anders app_settings — net als de Google-koppeling. */
export async function getMetaConfig(): Promise<MetaConfig | null> {
  const token = (process.env.META_ACCESS_TOKEN ?? '').trim();
  const accountId = (process.env.META_AD_ACCOUNT_ID ?? '').trim().replace(/^act_/, '');
  if (token && accountId) return { token, accountId };
  const stored = await getAppSetting<Partial<MetaConfig> | null>(META_KEY, null).catch(() => null);
  if (stored?.token && stored.accountId) {
    return { token: stored.token, accountId: String(stored.accountId).replace(/^act_/, ''), conversionActions: stored.conversionActions };
  }
  return null;
}

export async function storeMetaConfig(cfg: MetaConfig): Promise<void> {
  await setAppSetting(META_KEY, { ...cfg, accountId: cfg.accountId.replace(/^act_/, ''), updatedAt: new Date().toISOString() });
}

// ── Graph API ────────────────────────────────────────────────────────────
interface InsightRow {
  date_start: string;
  campaign_id: string;
  campaign_name: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  actions?: Action[];
  action_values?: Action[];
}

async function graphGet<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', token);
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & T;
  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `HTTP ${res.status}`;
    if (json.error?.code === 190) throw new Error(`Meta weigert het token (verlopen of ingetrokken): ${msg}`);
    throw new Error(`Meta API: ${msg}`);
  }
  return json;
}

/** Alle pagina's van een insights-lijst. */
async function graphAll<T>(path: string, params: Record<string, string>, token: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = null;
  let page = await graphGet<{ data: T[]; paging?: { next?: string } }>(path, params, token);
  for (;;) {
    out.push(...(page.data ?? []));
    next = page.paging?.next ?? null;
    if (!next) break;
    const res = await fetch(next, { signal: AbortSignal.timeout(60000) });
    page = (await res.json()) as { data: T[]; paging?: { next?: string } };
    if (!res.ok) throw new Error(`Meta API: paginering mislukte (${res.status})`);
  }
  return out;
}

/**
 * Dagcijfers per campagne. Status en kanaal komen van een aparte
 * campagnelijst; insights kennen die niet.
 */
export async function fetchMetaRows(cfg: MetaConfig, from: string, to: string): Promise<AdsDailyRow[]> {
  // Met of zonder 'act_' ingevuld: allebei goed.
  const account = `act_${cfg.accountId.trim().replace(/^act_/, '')}`;
  const [insights, campaigns] = await Promise.all([
    graphAll<InsightRow>(
      `${account}/insights`,
      {
        level: 'campaign',
        time_increment: '1',
        time_range: JSON.stringify({ since: from, until: to }),
        fields: 'date_start,campaign_id,campaign_name,impressions,clicks,spend,actions,action_values',
        limit: '500',
      },
      cfg.token,
    ),
    graphAll<{ id: string; status: string; objective?: string }>(
      `${account}/campaigns`,
      { fields: 'id,status,objective', limit: '500' },
      cfg.token,
    ),
  ]);
  const status = new Map(campaigns.map((c) => [c.id, c]));

  return insights
    .filter((r) => Number(r.impressions ?? 0) > 0)
    .map((r) => ({
      date: r.date_start,
      platform: 'meta' as const,
      campaignId: String(r.campaign_id),
      campaignName: r.campaign_name ?? '',
      // Meta zegt ACTIVE/PAUSED/ARCHIVED; we gebruiken dezelfde woorden als Google.
      campaignStatus: (status.get(r.campaign_id)?.status ?? '').replace('ACTIVE', 'ENABLED'),
      channel: (status.get(r.campaign_id)?.objective ?? 'META').replace(/^OUTCOME_/, ''),
      impressions: Number(r.impressions ?? 0),
      clicks: Number(r.clicks ?? 0),
      cost: Number(r.spend ?? 0),
      conversions: countConversions(r.actions, cfg.conversionActions),
      conversionValue: countConversions(r.action_values, cfg.conversionActions),
    }));
}

/** Zelfde contract als syncAds: nooit gooien, fout in de meta. */
export async function syncMetaAds({ days = 90 }: { days?: number } = {}): Promise<{ ok: boolean; skipped?: boolean; error?: string; rows?: number }> {
  const cfg = await getMetaConfig();
  if (!cfg) return { ok: false, skipped: true };
  const to = iso(Date.now() - DAY);
  const from = iso(Date.parse(to) - (days - 1) * DAY);
  try {
    const rows = await fetchMetaRows(cfg, from, to);
    const started = new Date().toISOString();
    await upsertAdsRows(rows);
    await deleteStaleAdsRows('meta', from, to, started);
    const vorige = await getAdsMeta('meta');
    const meta: AdsMeta = {
      lastSyncAt: started,
      fromDate: vorige?.fromDate && vorige.fromDate < from ? vorige.fromDate : from,
      toDate: to,
      rows: rows.length,
      source: 'meta',
      error: null,
    };
    await setAdsMeta(meta, 'meta');
    return { ok: true, rows: rows.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const vorige = await getAdsMeta('meta').catch(() => null);
    await setAdsMeta(
      {
        lastSyncAt: vorige?.lastSyncAt ?? null,
        fromDate: vorige?.fromDate ?? null,
        toDate: vorige?.toDate ?? null,
        rows: vorige?.rows ?? null,
        source: 'meta',
        error,
      },
      'meta',
    ).catch(() => undefined);
    console.error('[meta] sync mislukt:', error);
    return { ok: false, error };
  }
}
