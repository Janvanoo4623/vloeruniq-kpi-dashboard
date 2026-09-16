// Google Ads → Supabase — `npm run sync:ads`.
//
// Haalt dagcijfers per campagne op via de TrueClicks Google Ads MCP (dezelfde
// koppeling als in Claude/Codex) en schrijft ze naar ads_daily. Draait lokaal;
// er staat bewust geen Google-token op Vercel. Dit script raakt Teamleader
// niet aan en hoeft dus níet de sync-lock te claimen.
//
//   npm run sync:ads                      laatste 90 dagen (standaard)
//   npm run sync:ads -- --days 400        verder terug
//   npm run sync:ads -- --from 2024-11-01 --to 2025-03-31
//   npm run sync:ads -- --from-json .data/ads-backfill.json
//
// Waarom elke keer 90 dagen: Google corrigeert cijfers achteraf (ongeldige
// klikken, late conversies), dus de laatste weken moeten telkens opnieuw.
//
// Env (.env.local):
//   TRUECLICKS_MCP_TOKEN   Bearer-token voor de MCP (verplicht zonder --from-json)
//   TRUECLICKS_MCP_URL     standaard https://data.trueclicks.com/mcp
//   GOOGLE_ADS_CUSTOMER_ID standaard 2259199560 (Vloeruniq.nl, 225-919-9560)
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { readFileSync } from 'node:fs';
import { upsertAdsRows, deleteStaleAdsRows, setAdsMeta } from '../lib/db';
import { hasSupabase } from '../lib/supabase';
import type { AdsDailyRow } from '../lib/ads';

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().split('T')[0];

// ── Argumenten ───────────────────────────────────────────────────────────
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

// ── Rapport zoals de MCP het teruggeeft ──────────────────────────────────
interface Report {
  columns: string[];
  data: string[][];
}

/** Zet een GAQL-rapport (kolommen + rijen) om naar onze dagregels. */
export function reportToRows(report: Report): AdsDailyRow[] {
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
    // een paar cent verschil met wat Google zelf optelt. Afronden gebeurt pas bij
    // het optellen (lib/ads.ts).
    cost: Number(r[cCost] ?? 0) / 1e6,
    conversions: Number(r[cConv] ?? 0),
    conversionValue: Number(r[cConvVal] ?? 0),
  }));
}

export function gaql(from: string, to: string): string {
  return (
    'SELECT segments.date, campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, ' +
    'metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value ' +
    `FROM campaign WHERE segments.date BETWEEN '${from}' AND '${to}' AND metrics.impressions > 0 ` +
    'ORDER BY segments.date'
  );
}

// ── MCP over streamable HTTP (JSON-RPC) ──────────────────────────────────
class McpClient {
  private id = 0;
  private session: string | null = null;
  constructor(
    private url: string,
    private token: string,
  ) {}

  private async post(body: unknown): Promise<unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${this.token}`,
    };
    if (this.session) headers['Mcp-Session-Id'] = this.session;
    const res = await fetch(this.url, { method: 'POST', headers, body: JSON.stringify(body) });
    const sid = res.headers.get('mcp-session-id');
    if (sid) this.session = sid;
    if (res.status === 202 || res.status === 204) return null;
    const text = await res.text();
    if (!res.ok) throw new Error(`MCP ${res.status}: ${text.slice(0, 300)}`);
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('text/event-stream')) {
      // Eén of meer "data: {...}"-regels; de laatste met een result of error telt.
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
    if (!msg) throw new Error(`MCP ${method}: leeg antwoord`);
    if (msg.error) throw new Error(`MCP ${method}: ${msg.error.message ?? JSON.stringify(msg.error)}`);
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
    if (result?.isError) throw new Error(`MCP tool ${name}: ${text.slice(0, 300)}`);
    return text;
  }
}

async function fetchReport(from: string, to: string): Promise<Report> {
  const token = process.env.TRUECLICKS_MCP_TOKEN;
  if (!token) {
    throw new Error(
      'TRUECLICKS_MCP_TOKEN ontbreekt in .env.local. Zonder token kun je alleen importeren met --from-json.',
    );
  }
  const url = process.env.TRUECLICKS_MCP_URL || 'https://data.trueclicks.com/mcp';
  const customerId = Number(process.env.GOOGLE_ADS_CUSTOMER_ID || '2259199560');
  const mcp = new McpClient(url, token);
  await mcp.init();
  const text = await mcp.callTool('google-ads-download-report', {
    query: gaql(from, to),
    customerId,
    loginCustomerId: customerId,
  });
  const parsed = JSON.parse(text) as { isSuccessful?: boolean; result?: Report; notification?: { errors?: unknown[] } };
  if (parsed.isSuccessful === false || !parsed.result) {
    throw new Error(`Google Ads-rapport mislukt: ${JSON.stringify(parsed.notification ?? parsed).slice(0, 300)}`);
  }
  return parsed.result;
}

/** Een JSON-bestand met één rapport, een lijst rapporten, of een {rows: [...]}-export. */
function readJson(path: string): { rows: AdsDailyRow[]; from: string; to: string } {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  const reports: Report[] = Array.isArray(raw)
    ? (raw as Report[])
    : raw && typeof raw === 'object' && 'columns' in (raw as object)
      ? [raw as Report]
      : raw && typeof raw === 'object' && 'result' in (raw as object)
        ? [(raw as { result: Report }).result]
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
  let source: string;

  if (jsonPath) {
    ({ rows, from, to } = readJson(jsonPath));
    source = 'json';
    console.log(`[ads] import uit ${jsonPath}: ${rows.length} rijen, ${from} t/m ${to}`);
  } else {
    // Vandaag is nooit compleet in Google; tot en met gisteren is de laatste
    // volle dag.
    to = isDate(arg('to')) ? (arg('to') as string) : iso(Date.now() - DAY);
    const days = Number(arg('days') || 90);
    from = isDate(arg('from')) ? (arg('from') as string) : iso(Date.parse(to) - (days - 1) * DAY);
    source = 'mcp';
    console.log(`[ads] ophalen via MCP: ${from} t/m ${to}`);
    rows = reportToRows(await fetchReport(from, to));
    console.log(`[ads] ${rows.length} dagregels ontvangen`);
  }

  const started = new Date().toISOString();
  await upsertAdsRows(rows);
  const stale = await deleteStaleAdsRows(from, to, started);
  await setAdsMeta({ lastSyncAt: started, fromDate: from, toDate: to, rows: rows.length, source, error: null });

  const cost = rows.reduce((s, r) => s + r.cost, 0);
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const conv = rows.reduce((s, r) => s + r.conversions, 0);
  console.log(`[ads] klaar: ${rows.length} rijen geschreven, ${stale} verouderde rijen verwijderd`);
  console.table({
    Periode: `${from} t/m ${to}`,
    'Kosten (€)': Math.round(cost * 100) / 100,
    Klikken: clicks,
    Conversies: Math.round(conv * 10) / 10,
    Campagnes: new Set(rows.map((r) => r.campaignId)).size,
  });
  process.exit(0);
}

if (process.argv[1] && /ads-sync\.ts$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error('\n[ads] MISLUKT:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
