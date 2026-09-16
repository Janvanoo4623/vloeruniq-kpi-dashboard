// Google Ads → Supabase, server-side. Gebruikt door de Vernieuwen-knop
// (/api/refresh), de cron (/api/sync) en het lokale script (scripts/ads-sync.ts).
//
// De bron is GAQL.app van TrueClicks: een gewone REST-API met een vast token,
// dezelfde die hun MCP-pakket onder water aanroept. Daardoor kan de app het
// zelf, zonder browser-login. Het token (GAQL_TOKEN) geeft toegang tot álle
// Google Ads-accounts van de TrueClicks-gebruiker; de app vraagt alleen het
// Vloeruniq-account op (GOOGLE_ADS_CUSTOMER_ID).
//
// Dit raakt Teamleader niet aan en hoeft dus níet de Teamleader-sync-lock te
// claimen. Twee Ads-syncs tegelijk zijn ongevaarlijk: dezelfde rijen, dezelfde
// waarden, upsert.
import { upsertAdsRows, deleteStaleAdsRows, setAdsMeta, getAdsMeta, type AdsMeta } from './db';
import type { AdsDailyRow } from './ads';

const API_BASE = 'https://api.gaql.app';
const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().split('T')[0];

/** Het rapport zoals GAQL.app (en de TrueClicks MCP) het teruggeeft. */
export interface AdsReport {
  columns: string[];
  data: string[][];
}

export function gaql(from: string, to: string): string {
  return (
    'SELECT segments.date, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, ' +
    'metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value ' +
    `FROM campaign WHERE segments.date BETWEEN '${from}' AND '${to}' AND metrics.impressions > 0 ` +
    'ORDER BY segments.date'
  );
}

/** Zet een GAQL-rapport (kolommen + rijen) om naar onze dagregels. */
export function reportToRows(report: AdsReport): AdsDailyRow[] {
  const col = (name: string) => {
    const i = report.columns.indexOf(name);
    if (i < 0) throw new Error(`Kolom ${name} ontbreekt in het rapport (${report.columns.join(', ')})`);
    return i;
  };
  const cDate = col('segments.date');
  const cId = col('campaign.id');
  const cName = col('campaign.name');
  const cStatus = col('campaign.status');
  const cChannel = col('campaign.advertisingChannelType');
  const cImp = col('metrics.impressions');
  const cClicks = col('metrics.clicks');
  const cCost = col('metrics.costMicros');
  const cConv = col('metrics.conversions');
  const cConvVal = col('metrics.conversionsValue');
  return report.data.map((r) => ({
    date: r[cDate],
    campaignId: String(r[cId]),
    campaignName: r[cName] ?? '',
    campaignStatus: r[cStatus] ?? '',
    channel: r[cChannel] ?? '',
    impressions: Number(r[cImp] ?? 0),
    clicks: Number(r[cClicks] ?? 0),
    // Micros → euro, onafgerond: per rij op centen afronden gaf over een maand
    // een paar cent verschil met wat Google zelf optelt. Afronden gebeurt pas
    // bij het optellen (lib/ads.ts).
    cost: Number(r[cCost] ?? 0) / 1e6,
    conversions: Number(r[cConv] ?? 0),
    conversionValue: Number(r[cConvVal] ?? 0),
  }));
}

export function adsConfigured(): boolean {
  return Boolean(process.env.GAQL_TOKEN);
}

/** Haal het rapport op bij GAQL.app. Gooit een leesbare fout bij alles wat misgaat. */
export async function fetchAdsReport(from: string, to: string): Promise<AdsReport> {
  const token = process.env.GAQL_TOKEN;
  if (!token) throw new Error('GAQL_TOKEN ontbreekt (Google Ads-token van gaql.app).');
  const customerId = Number(process.env.GOOGLE_ADS_CUSTOMER_ID || '2259199560');

  const res = await fetch(`${API_BASE}/api/gpt/google-ads/execute-query?gptToken=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'vloeruniq-kpi-dashboard/1.0' },
    body: JSON.stringify({ query: gaql(from, to), customerId, loginCustomerId: customerId, reportAggregation: '' }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) throw new Error(`GAQL.app weigert het token (${res.status}). Maak een nieuw token op gaql.app.`);
    throw new Error(`GAQL.app ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    isSuccessful?: boolean;
    result?: AdsReport;
    columns?: string[];
    data?: string[][];
    notification?: { errors?: unknown[] };
  };
  const report = json.result ?? (json.columns && json.data ? { columns: json.columns, data: json.data } : null);
  if (json.isSuccessful === false || !report) {
    throw new Error(`Google Ads-rapport mislukt: ${JSON.stringify(json.notification ?? json).slice(0, 200)}`);
  }
  return report;
}

/** Schrijf dagregels weg en werk de meta bij. Gedeeld door script en API. */
export async function storeAdsRows(
  rows: AdsDailyRow[],
  from: string,
  to: string,
  source: 'gaql' | 'json',
): Promise<{ rows: number; stale: number; meta: AdsMeta }> {
  const started = new Date().toISOString();
  await upsertAdsRows(rows);
  const stale = await deleteStaleAdsRows(from, to, started);
  const meta: AdsMeta = { lastSyncAt: started, fromDate: from, toDate: to, rows: rows.length, source, error: null };
  // De historie begint waar de eerste import begon; een 90-daagse verversing
  // mag dat niet naar voren schuiven, anders lijkt het alsof 2024 weg is.
  const vorige = await getAdsMeta();
  if (vorige?.fromDate && vorige.fromDate < from) meta.fromDate = vorige.fromDate;
  await setAdsMeta(meta);
  return { rows: rows.length, stale, meta };
}

/**
 * De verversing zoals de Vernieuwen-knop en de cron hem draaien: de laatste
 * `days` dagen t/m gisteren (vandaag is bij Google nooit compleet). Google
 * corrigeert achteraf, vandaar standaard 90 dagen en niet alleen gisteren.
 * Een fout wordt in ads_sync_meta gezet en teruggegeven, nooit gegooid: de
 * Teamleader-sync mag er niet op stuklopen.
 */
export async function syncAds({ days = 90 }: { days?: number } = {}): Promise<{ ok: boolean; error?: string; rows?: number }> {
  const to = iso(Date.now() - DAY);
  const from = iso(Date.parse(to) - (days - 1) * DAY);
  try {
    const rows = reportToRows(await fetchAdsReport(from, to));
    const r = await storeAdsRows(rows, from, to, 'gaql');
    return { ok: true, rows: r.rows };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const vorige = await getAdsMeta().catch(() => null);
    await setAdsMeta({
      lastSyncAt: vorige?.lastSyncAt ?? null,
      fromDate: vorige?.fromDate ?? null,
      toDate: vorige?.toDate ?? null,
      rows: vorige?.rows ?? null,
      source: vorige?.source ?? null,
      error,
    }).catch(() => undefined);
    console.error('[ads] sync mislukt:', error);
    return { ok: false, error };
  }
}
