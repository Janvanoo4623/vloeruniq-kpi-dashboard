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
import { upsertAdsRows, deleteStaleAdsRows, setAdsMeta, getAdsMeta, getAppSetting, setAppSetting, type AdsMeta } from './db';
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
    'metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.all_conversions, metrics.all_conversions_value ' +
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
  // 'Alle conversies' (metrics.all_conversions), niet de hoofdkolom 'Conversies':
  // Jan telt alle conversieacties mee, ook de secundaire (bellen, route).
  const cConv = col('metrics.allConversions');
  const cConvVal = col('metrics.allConversionsValue');
  return report.data.map((r) => ({
    date: r[cDate],
    platform: 'google' as const,
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

// ── Waar de koppeling vandaan komt ───────────────────────────────────────
// Eerst de env (lokaal, of Vercel als iemand daar de rechten voor heeft), anders
// app_settings in Supabase. Dat laatste is dezelfde keuze als voor het
// Teamleader-token: de opslag is alleen server-side bereikbaar, en Jasper kan
// er zonder Vercel-rechten bij. `npm run ads:token` zet hem erin.
const ADS_SOURCE_KEY = 'ads_gaql';

export async function getGaqlToken(): Promise<string | null> {
  const env = (process.env.GAQL_TOKEN ?? '').trim();
  if (env) return env;
  const stored = await getAppSetting<{ token?: string } | null>(ADS_SOURCE_KEY, null).catch(() => null);
  const token = stored?.token?.trim();
  return token || null;
}

export async function storeGaqlToken(token: string): Promise<void> {
  await setAppSetting(ADS_SOURCE_KEY, { token: token.trim(), updatedAt: new Date().toISOString() });
}

// ── Twee transporten, één env-variabele ──────────────────────────────────
// GAQL_TOKEN is óf de volledige URL van de gehoste GAQL-MCP
// (https://mcp.gaql.app/mcp/google-ads/<token>, zoals hij in een MCP-config
// staat) óf een los token voor de REST-API (api.gaql.app?gptToken=). Jasper
// plakte de URL; die vorm is wat TrueClicks uitdeelt, dus dat is de eerste
// keus. Het losse token blijft werken voor wie dat heeft.

/** Streamable-HTTP MCP: JSON-RPC over POST, met sessie-header en SSE-antwoorden. */
class McpClient {
  private id = 0;
  private session: string | null = null;
  constructor(private url: string) {}

  private async post(body: unknown): Promise<unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    };
    if (this.session) headers['Mcp-Session-Id'] = this.session;
    const res = await fetch(this.url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
    const sid = res.headers.get('mcp-session-id');
    if (sid) this.session = sid;
    if (res.status === 202 || res.status === 204) return null;
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        throw new Error(`GAQL-MCP weigert de koppeling (${res.status}). Klopt de URL in GAQL_TOKEN nog?`);
      }
      throw new Error(`GAQL-MCP ${res.status}: ${text.slice(0, 200)}`);
    }
    if ((res.headers.get('content-type') ?? '').includes('text/event-stream')) {
      let last: unknown = null;
      for (const line of text.split('\n')) {
        if (!line.startsWith('data:')) continue;
        try {
          const msg = JSON.parse(line.slice(5).trim());
          if (msg && (msg.result !== undefined || msg.error !== undefined)) last = msg;
        } catch {
          /* geen JSON-regel */
        }
      }
      return last;
    }
    return text ? JSON.parse(text) : null;
  }

  private async rpc(method: string, params: unknown): Promise<unknown> {
    const msg = (await this.post({ jsonrpc: '2.0', id: ++this.id, method, params })) as {
      result?: unknown;
      error?: { message?: string };
    } | null;
    if (!msg) throw new Error(`GAQL-MCP ${method}: leeg antwoord`);
    if (msg.error) throw new Error(`GAQL-MCP ${method}: ${msg.error.message ?? JSON.stringify(msg.error)}`);
    return msg.result;
  }

  async init(): Promise<void> {
    await this.rpc('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'vloeruniq-kpi-dashboard', version: '1.0' },
    });
    await this.post({ jsonrpc: '2.0', method: 'notifications/initialized' });
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = (await this.rpc('tools/call', { name, arguments: args })) as {
      content?: { type: string; text?: string }[];
      isError?: boolean;
    };
    const text = result?.content?.find((c) => c.type === 'text')?.text ?? '';
    if (result?.isError) throw new Error(`GAQL-MCP ${name}: ${text.slice(0, 200)}`);
    return text;
  }
}

function parseReport(json: {
  isSuccessful?: boolean;
  result?: AdsReport;
  columns?: string[];
  data?: string[][];
  notification?: { errors?: unknown[] };
}): AdsReport {
  const report = json.result ?? (json.columns && json.data ? { columns: json.columns, data: json.data } : null);
  if (json.isSuccessful === false || !report) {
    throw new Error(`Google Ads-rapport mislukt: ${JSON.stringify(json.notification ?? json).slice(0, 200)}`);
  }
  return report;
}

/** Haal het rapport op. Gooit een leesbare fout bij alles wat misgaat. */
export async function fetchAdsReport(from: string, to: string): Promise<AdsReport> {
  const token = await getGaqlToken();
  if (!token) throw new Error('Geen GAQL-koppeling: zet GAQL_TOKEN in .env.local of draai npm run ads:token.');
  const customerId = Number(process.env.GOOGLE_ADS_CUSTOMER_ID || '2259199560');
  const query = gaql(from, to);

  if (/^https?:\/\//.test(token)) {
    const mcp = new McpClient(token);
    await mcp.init();
    const text = await mcp.callTool('google-ads-download-report', { query, customerId, loginCustomerId: customerId });
    return parseReport(JSON.parse(text));
  }

  const res = await fetch(`${API_BASE}/api/gpt/google-ads/execute-query?gptToken=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'vloeruniq-kpi-dashboard/1.0' },
    body: JSON.stringify({ query, customerId, loginCustomerId: customerId, reportAggregation: '' }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) throw new Error(`GAQL.app weigert het token (${res.status}). Maak een nieuw token op gaql.app.`);
    throw new Error(`GAQL.app ${res.status}: ${text.slice(0, 200)}`);
  }
  return parseReport(await res.json());
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
  const stale = await deleteStaleAdsRows('google', from, to, started);
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
export async function syncAds({ days = 90 }: { days?: number } = {}): Promise<{ ok: boolean; skipped?: boolean; error?: string; rows?: number }> {
  const to = iso(Date.now() - DAY);
  const from = iso(Date.parse(to) - (days - 1) * DAY);
  // Zonder koppeling stil overslaan — geen fout in de meta, want er is niets
  // misgegaan; er is alleen nog niets ingesteld.
  if (!(await getGaqlToken())) return { ok: false, skipped: true };
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
