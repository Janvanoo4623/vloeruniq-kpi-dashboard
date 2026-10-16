// Moneybird: de kosten uit de boekhouding, per maand en per grootboekrekening.
//
// Wat we wél en níet uit Moneybird halen. Facturen komen al uit Teamleader en
// Combidesk kopieert ze naar Moneybird; die nog eens ophalen zou ze dubbel
// tellen. Moneybird levert wat Teamleader niet heeft: wat er werkelijk is
// uitgegeven — inkoop materialen, uitbesteed werk, vaste lasten — zoals de
// boekhouder het geboekt heeft, inclusief afschrijvingen van de bank zonder
// factuur. Bron is het winst-en-verliesrapport (`reports/profit_loss`) met
// granularity=month: één aanroep per twaalf maanden, en het rapport telt precies
// zoals Moneybird zelf telt.
//
// Opslag: één JSON in app_settings (`moneybird_pl`). Het gaat om een paar
// honderd getallen; een eigen tabel zou alleen een migratie kosten.
//
// Koppeling: MONEYBIRD_TOKEN in de env (lokaal) gaat vóór app_settings
// `moneybird` (productie, gezet met `npm run moneybird:token`) — zelfde patroon
// als Google en Meta, omdat er op Vercel geen productie-env gezet kan worden.
import { getAppSetting, setAppSetting } from './db';

const API = 'https://moneybird.com/api/v2';
const CONFIG_KEY = 'moneybird';
const PL_KEY = 'moneybird_pl';

export interface MoneybirdConfig {
  token: string;
  administrationId: string;
}

export type LedgerKind = 'revenue' | 'direct_costs' | 'expenses' | 'other_income_expenses';

export interface LedgerAccount {
  id: string;
  name: string;
  kind: LedgerKind;
  /** Rekeningnummer in het grootboek, zoals de boekhouder het kent. */
  code: string;
}

/** Eén maand uit het W&V-rapport: bedrag per grootboekrekening, ex btw. */
export interface MoneybirdMonth {
  month: string; // YYYY-MM
  /** ledger_account_id → bedrag. Kosten positief; overige baten/lasten zoals Moneybird ze geeft. */
  values: Record<string, number>;
  revenue: number;
  directCosts: number;
  expenses: number;
  other: number;
}

/** Een inkoopfactuur die in Moneybird nog openstaat (state open of late). */
export interface OpenPurchase {
  id: string;
  supplier: string;
  date: string; // factuurdatum
  dueDate: string; // '' als onbekend
  /** Nog te betalen, incl btw (totaal min de al geregistreerde betalingen). */
  open: number;
  late: boolean;
}

export interface MoneybirdPL {
  syncedAt: string | null;
  error: string | null;
  administrationName: string | null;
  /** Begin van de administratie in Moneybird (period_start_date). */
  periodStart: string | null;
  accounts: LedgerAccount[];
  months: MoneybirdMonth[];
  /** Saldo van alle bankrekeningen in Moneybird, op het moment van ophalen. */
  bankBalance?: number | null;
  /** Openstaande inkoopfacturen, voor de uitgaande kant van de cashprognose. */
  openPurchases?: OpenPurchase[];
}

export const EMPTY_PL: MoneybirdPL = {
  syncedAt: null,
  error: null,
  administrationName: null,
  periodStart: null,
  accounts: [],
  months: [],
  bankBalance: null,
  openPurchases: [],
};

export async function getMoneybirdConfig(): Promise<MoneybirdConfig | null> {
  const token = (process.env.MONEYBIRD_TOKEN ?? '').trim();
  const envAdmin = (process.env.MONEYBIRD_ADMINISTRATION_ID ?? '').trim();
  if (token) {
    // Zonder administratienummer in de env: dat uit de opslag, of de enige die het token ziet.
    const stored = await getAppSetting<Partial<MoneybirdConfig> | null>(CONFIG_KEY, null).catch(() => null);
    return { token, administrationId: envAdmin || stored?.administrationId || '' };
  }
  const stored = await getAppSetting<Partial<MoneybirdConfig> | null>(CONFIG_KEY, null).catch(() => null);
  if (stored?.token) return { token: stored.token, administrationId: stored.administrationId ?? '' };
  return null;
}

export async function storeMoneybirdConfig(cfg: MoneybirdConfig): Promise<void> {
  await setAppSetting(CONFIG_KEY, { ...cfg, updatedAt: new Date().toISOString() });
}

export async function getMoneybirdPL(): Promise<MoneybirdPL> {
  return getAppSetting<MoneybirdPL>(PL_KEY, EMPTY_PL).catch(() => EMPTY_PL);
}

async function mbGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 200);
    try {
      const j = JSON.parse(text) as { error?: string | { message?: string } };
      msg = typeof j.error === 'string' ? j.error : (j.error?.message ?? msg);
    } catch {
      /* geen JSON */
    }
    if (res.status === 401) throw new Error(`Moneybird weigert het token (ingetrokken of zonder rechten): ${msg}`);
    if (res.status === 403) throw new Error(`Moneybird: het token mist een recht voor ${path.split('?')[0]}: ${msg}`);
    throw new Error(`Moneybird ${path.split('?')[0]} → ${res.status}: ${msg}`);
  }
  return JSON.parse(text) as T;
}

interface MbAdministration {
  id: string;
  name: string;
  period_start_date?: string | null;
}

interface MbLedgerAccount {
  id: string;
  name: string;
  account_type: string;
  account_id?: string | null;
}

interface MbLedgerValues {
  ledger_accounts: { ledger_account_id: string; value: string }[];
}

interface MbPeriod {
  period: string; // "202607..202607"
  revenue_by_ledger_account: MbLedgerValues;
  direct_costs_by_ledger_account: MbLedgerValues;
  expenses_by_ledger_account: MbLedgerValues;
  other_income_expenses_by_ledger_account: MbLedgerValues;
}

interface MbPurchaseInvoice {
  id: string;
  date?: string | null;
  due_date?: string | null;
  state?: string;
  total_price_incl_tax?: string;
  payments?: { price?: string }[];
  contact?: { company_name?: string | null; firstname?: string | null; lastname?: string | null } | null;
}

const KINDS: LedgerKind[] = ['revenue', 'direct_costs', 'expenses', 'other_income_expenses'];

const ym = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Maanden van `start` (YYYY-MM-DD) t/m nu, in blokken van max. twaalf (de grens van het rapport). */
function periodChunks(start: string, now: Date): string[] {
  const chunks: string[] = [];
  let cur = new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  while (cur <= end) {
    const last = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 11, 1));
    const stop = last < end ? last : end;
    chunks.push(`${ym(cur)}..${ym(stop)}`);
    cur = new Date(Date.UTC(stop.getUTCFullYear(), stop.getUTCMonth() + 1, 1));
  }
  return chunks;
}

/** Haal administratie, grootboek en het W&V-rapport per maand op. Gooit bij een fout. */
export async function fetchMoneybirdPL(cfg: MoneybirdConfig): Promise<MoneybirdPL> {
  const admins = await mbGet<MbAdministration[]>('/administrations.json', cfg.token);
  const admin = cfg.administrationId ? admins.find((a) => a.id === cfg.administrationId) : admins.length === 1 ? admins[0] : undefined;
  if (!admin) {
    throw new Error(
      cfg.administrationId
        ? `Moneybird: administratie ${cfg.administrationId} niet zichtbaar voor dit token.`
        : `Moneybird: het token ziet ${admins.length} administraties; zet MONEYBIRD_ADMINISTRATION_ID.`,
    );
  }
  const base = `/${admin.id}`;

  const ledger = await mbGet<MbLedgerAccount[]>(`${base}/ledger_accounts.json`, cfg.token);
  const accounts: LedgerAccount[] = ledger
    .filter((l) => (KINDS as string[]).includes(l.account_type))
    .map((l) => ({ id: l.id, name: l.name, kind: l.account_type as LedgerKind, code: l.account_id ?? '' }));

  const start = admin.period_start_date || '2025-01-01';
  const months: MoneybirdMonth[] = [];
  for (const period of periodChunks(start, new Date())) {
    const rep = await mbGet<{ periods?: MbPeriod[] }>(
      `${base}/reports/profit_loss.json?period=${period}&granularity=month`,
      cfg.token,
    );
    for (const p of rep.periods ?? []) {
      const values: Record<string, number> = {};
      const sum = (v: MbLedgerValues | undefined) => {
        let t = 0;
        for (const l of v?.ledger_accounts ?? []) {
          const n = Number(l.value);
          if (!Number.isFinite(n)) continue;
          values[l.ledger_account_id] = r2((values[l.ledger_account_id] ?? 0) + n);
          t += n;
        }
        return r2(t);
      };
      months.push({
        month: `${p.period.slice(0, 4)}-${p.period.slice(4, 6)}`,
        revenue: sum(p.revenue_by_ledger_account),
        directCosts: sum(p.direct_costs_by_ledger_account),
        expenses: sum(p.expenses_by_ledger_account),
        other: sum(p.other_income_expenses_by_ledger_account),
        values,
      });
    }
  }
  months.sort((a, b) => a.month.localeCompare(b.month));

  // Banksaldo en openstaande inkoop: voor de cashprognose. Een fout hier mag het
  // W&V-rapport niet tegenhouden — dan blijven deze twee leeg.
  let bankBalance: number | null = null;
  let openPurchases: OpenPurchase[] = [];
  try {
    const bal = await mbGet<{ total?: string }>(`${base}/reports/bank_balance.json`, cfg.token);
    bankBalance = bal.total != null && Number.isFinite(Number(bal.total)) ? r2(Number(bal.total)) : null;
    const rows: MbPurchaseInvoice[] = [];
    for (let page = 1; page <= 20; page++) {
      const batch = await mbGet<MbPurchaseInvoice[]>(
        `${base}/documents/purchase_invoices.json?filter=state:open|late&per_page=100&page=${page}`,
        cfg.token,
      );
      rows.push(...batch);
      if (batch.length < 100) break;
    }
    openPurchases = rows.map((r) => {
      const betaald = (r.payments ?? []).reduce((t, p) => t + Number(p.price ?? 0), 0);
      return {
        id: r.id,
        supplier: r.contact?.company_name || [r.contact?.firstname, r.contact?.lastname].filter(Boolean).join(' ') || '—',
        date: r.date ?? '',
        dueDate: r.due_date ?? '',
        open: r2(Number(r.total_price_incl_tax ?? 0) - betaald),
        late: r.state === 'late',
      };
    }).filter((r) => r.open > 0);
  } catch (err) {
    console.warn('[moneybird] banksaldo/inkoop niet opgehaald:', err instanceof Error ? err.message : err);
  }

  return {
    syncedAt: new Date().toISOString(),
    error: null,
    administrationName: admin.name,
    periodStart: admin.period_start_date ?? null,
    accounts,
    months,
    bankBalance,
    openPurchases,
  };
}

/** Zelfde contract als syncAds: nooit gooien, fout in de opslag zodat de pagina hem kan tonen. */
export async function syncMoneybird(): Promise<{ ok: boolean; skipped?: boolean; error?: string; months?: number }> {
  const cfg = await getMoneybirdConfig();
  if (!cfg) return { ok: false, skipped: true };
  try {
    const pl = await fetchMoneybirdPL(cfg);
    await setAppSetting(PL_KEY, pl);
    return { ok: true, months: pl.months.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const vorige = await getMoneybirdPL();
    await setAppSetting(PL_KEY, { ...vorige, error }).catch(() => undefined);
    console.error('[moneybird] sync mislukt:', error);
    return { ok: false, error };
  }
}
