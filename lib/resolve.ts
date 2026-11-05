// Marges bij het LEZEN berekenen in plaats van ze bij het synchroniseren vast
// te vriezen.
//
// Waarom dit er is. Tot 2026-09-09 legde matching.ts de inkoopprijs, de
// ondervloer en het arbeidstarief per regel vast op het moment van
// synchroniseren. Een prijs die je daarna in Instellingen aanpaste, veranderde
// dus niets aan wat je zag — behalve bij de offertes die het venster van 90
// dagen toevallig opnieuw ophaalde. Jan zette op 25 augustus het arbeidstarief
// van EUR 17 naar EUR 11 en dat werkte door op 53 van de 18.060 beprijsde m².
// Zo lijkt het dashboard kapot terwijl de invoer klopt.
//
// Sinds deze module gebeurt het omgekeerde: de opgeslagen regel bewaart wat er
// verkocht is (omschrijving, m², omzet, legwijze, wel/geen legservice) en de
// prijzen komen bij elke pagina-render vers uit de prijslijst, tegen de datum
// van de offerte. Een prijs met terugwerkende kracht werkt daarmee meteen door,
// een prijs die vanaf vandaag ingaat raakt alleen nieuwe offertes, en een
// backfill is er niet meer voor nodig.
//
// De opgeslagen waarden blijven de bodem: is er geen prijsrij te vinden, dan
// telt wat er bij de sync is berekend. Zo kan een lege prijslijst nooit
// stilzwijgend alle marges op nul zetten.
import { COST_FALLBACK } from './teamleader/constants';
import { costsForDate, priceConfigForDate, type CostRow, type PriceRow } from './pricing';
import type { PriceConfig } from './teamleader/price-map';
import { buildSnapshot } from './teamleader/aggregate';
import type { AggLine } from './teamleader/quotations';
import { deriveDateParts } from './teamleader/dates';
import { isExtraCode } from './extras';
import type {
  InvoiceExtraLine,
  QuotationFields,
  QuotationLine,
  QuotationLineOverride,
  QuotationOverride,
  QuotationRow,
  Snapshot,
} from './types';

const round2 = (v: number) => Math.round(v * 100) / 100;
const round1 = (v: number) => Math.round(v * 10) / 10;

const P_NUMBER = /^P\d{3}$/i;

export interface ResolveInput {
  prices: PriceRow[];
  costs: CostRow[];
  overrides: Record<string, QuotationOverride>;
  /**
   * Per deal: totaal gefactureerd (ex btw, zonder creditnota's). Ontbreekt dit,
   * dan blijft de status uit Teamleader staan.
   */
  invoicedPerDeal?: Record<string, number>;
  /** Per deal: de datum waarop hij in Teamleader gewonnen is (closed_at). */
  dealWonAt?: Record<string, string>;
  /**
   * Per deal: overige producten op de facturen (plinten, entreematten …),
   * opgeteld per code. Wat er méér gefactureerd is dan op de offerte stond is
   * nacalculatie en komt bij de offerte — zie addInvoiceExtras().
   */
  invoiceExtras?: Record<string, InvoiceExtraLine[]>;
}

/**
 * De datum waartegen prijzen en kosten worden opgezocht: de aanmaakdatum van de
 * offerte, precies zoals fetchQuotations() dat bij het synchroniseren doet. Niet
 * de beslisdatum — een offerte uit januari die in juni verloopt is in januari
 * geprijsd.
 */
const priceDate = (q: QuotationRow): string => q.dateCreated || q.dateAccepted || '';

/**
 * Inkoopprijs voor één regel, in dezelfde volgorde als matching.ts die bij het
 * synchroniseren hanteert: eerst het P-nummer, dan een naam uit de prijslijst
 * die in de omschrijving voorkomt (langste naam eerst). Daarna pas een exacte
 * match op de productnaam zelf — die vangt de afgeleide namen op, die Jan via
 * Controleren onder precies die naam beprijst.
 */
function purchaseForLine(line: QuotationLine, config: PriceConfig): number | null {
  const code = line.code.trim();
  if (P_NUMBER.test(code)) {
    const p = config.pNumbers[code.toUpperCase()];
    if (p !== undefined) return p;
  }
  const desc = line.desc?.toLowerCase() ?? '';
  if (desc) {
    for (const nm of config.nameMatches) {
      // Een kostprijs per trede of per meter plint hoort nooit op een vloer.
      if (isExtraCode(nm.name)) continue;
      if (desc.includes(nm.name)) return nm.price;
    }
  }
  const lower = code.toLowerCase();
  for (const nm of config.nameMatches) {
    if (nm.name === lower) return nm.price;
  }
  return null;
}

/**
 * Ondervloer- en arbeidstarief voor één regel. `installMode` en `laborRule` zijn
 * bij het synchroniseren uit de offertetekst afgeleid en veranderen niet meer;
 * alleen de bedragen eronder komen vers uit de kosteninstellingen. Regels die
 * van vóór die velden dateren vallen terug op wat er is opgeslagen.
 */
function ratesForLine(
  line: QuotationLine,
  costs: { alwaysPerM2: number; gluedPerM2: number; selfAdhesivePerM2: number },
): { underlay: number; labor: number } {
  const underlay =
    line.installMode === 'selfadhesive'
      ? costs.selfAdhesivePerM2
      : line.installMode === 'glued'
        ? costs.gluedPerM2
        : line.installMode === 'click'
          ? 0
          : (line.underlayPerM2 ?? line.gluedPerM2 ?? 0);
  const labor =
    line.laborRule === 'excluded'
      ? 0
      : line.laborRule
        ? costs.alwaysPerM2
        : (line.laborPerM2 ?? costs.alwaysPerM2);
  return { underlay, labor };
}

/**
 * Handmatig overschreven offertevelden toepassen vóór er iets wordt gerekend.
 * Status en datums horen hier: ze bepalen in welke periode de offerte valt en
 * hoe de maand/kwartaal-indeling uitvalt, dus die moeten kloppen vóór de
 * aggregatie eroverheen loopt.
 *
 * Regelcorrecties gaan op volgnummer. Is het aantal regels sinds het corrigeren
 * veranderd, dan is de offerte in Teamleader herzien en slaan ze nergens meer
 * op; ze worden dan genegeerd in plaats van op een andere regel toegepast.
 */
function applyFields(q: QuotationRow, fields: QuotationFields): QuotationRow {
  const lines = q.lines ?? [];
  const regelCorrecties: Record<string, QuotationLineOverride> =
    fields.lines && (fields.lineCount == null || fields.lineCount === lines.length)
      ? fields.lines
      : {};

  let deltaM2 = 0;
  let deltaOmzet = 0;
  const nieuweRegels = lines.map((l, i) => {
    const c = regelCorrecties[String(i)];
    if (!c) return l;
    if (l.kind === 'extra') {
      // Overig product: telt niet in m² of vloeromzet, dus alleen de regel zelf.
      return { ...l, revenue: c.revenue ?? l.revenue };
    }
    const m2 = c.m2 ?? l.m2;
    const revenue = c.revenue ?? l.revenue;
    deltaM2 += m2 - l.m2;
    deltaOmzet += revenue - l.revenue;
    return {
      ...l,
      code: c.code?.trim() || l.code,
      m2,
      revenue,
      ...(c.underlayPerM2 != null ? { underlayPerM2: c.underlayPerM2 } : {}),
      ...(c.laborPerM2 != null ? { laborPerM2: c.laborPerM2 } : {}),
    };
  });

  const status = fields.status ?? q.status;
  const dateCreated = fields.dateCreated ?? q.dateCreated;
  const dateAccepted = fields.dateAccepted ?? q.dateAccepted;
  const relevant = status !== 'open' && dateAccepted ? dateAccepted : dateCreated;
  const { month, quarter, year } = deriveDateParts(relevant);

  const totalM2 = Math.round((q.totalM2 + deltaM2) * 100) / 100;
  const omzetVloer = fields.omzetVloer ?? round2(q.omzetVloer + deltaOmzet);

  return {
    ...q,
    status,
    dateCreated,
    dateAccepted,
    month,
    quarter,
    year,
    lines: nieuweRegels,
    totalM2,
    omzetVloer,
    revenueExVat: fields.revenueExVat ?? q.revenueExVat,
    prijsPerM2: totalM2 > 0 ? round2(omzetVloer / totalM2) : 0,
  };
}

/**
 * Welke velden een mens heeft aangepast, zodat de modal ze kan merken als
 * handmatig. Puur afgeleid, staat nergens opgeslagen.
 */
export function overriddenFieldKeys(fields: QuotationFields | undefined): Set<string> {
  const keys = new Set<string>();
  if (!fields) return keys;
  for (const k of ['revenueExVat', 'omzetVloer', 'status', 'dateCreated', 'dateAccepted'] as const) {
    if (fields[k] != null) keys.add(k);
  }
  for (const [i, c] of Object.entries(fields.lines ?? {})) {
    for (const k of Object.keys(c)) keys.add(`lines.${i}.${k}`);
  }
  return keys;
}

/**
 * Kostprijs per eenheid van een overig product: handmatige correctie op deze
 * offerte, dan de prijslijst op exact de code (geen deelmatch op de
 * omschrijving — zie lib/extras.ts), dan wat er bij de sync is vastgelegd.
 */
function costForExtra(line: QuotationLine, config: PriceConfig, override: QuotationOverride | undefined): number | null {
  const lower = line.code.trim().toLowerCase();
  const special = override?.prices[lower];
  if (special != null) return special;
  const nm = config.nameMatches.find((n) => n.name === lower);
  if (nm) return nm.price;
  return line.costPerUnit ?? null;
}

/** Eén offerte doorrekenen tegen de prijzen en kosten van zijn eigen datum. */
function recompute(
  q: QuotationRow,
  config: PriceConfig,
  costs: { alwaysPerM2: number; gluedPerM2: number; selfAdhesivePerM2: number },
  override: QuotationOverride | undefined,
  nacalculatie: QuotationLine[] = [],
): QuotationRow {
  const toegepast = override?.fields ? applyFields(q, override.fields) : q;
  // Nacalculatie komt ná de veldcorrecties: die gaan op volgnummer en mogen
  // niet verschuiven doordat er een factuurregel achteraan bij komt.
  const basis =
    nacalculatie.length > 0
      ? {
          ...toegepast,
          lines: [...(toegepast.lines ?? []), ...nacalculatie],
          revenueExVat: round2(toegepast.revenueExVat + nacalculatie.reduce((t, l) => t + l.revenue, 0)),
        }
      : toegepast;
  const lines = basis.lines ?? [];
  if (lines.length === 0) return basis;

  // Overige producten: kostprijs per eenheid × aantal, verder niets.
  let extraCost = 0;
  let extraRevenue = 0;
  let extraPriced = false;
  const extraLines = new Map<number, QuotationLine>();
  lines.forEach((l, i) => {
    if (l.kind !== 'extra') return;
    const cpu = costForExtra(l, config, override);
    const qty = l.qty ?? 0;
    if (cpu == null) {
      extraLines.set(i, { ...l, margin: null });
      return;
    }
    extraCost += cpu * qty;
    extraRevenue += l.revenue;
    extraPriced = true;
    extraLines.set(i, { ...l, costPerUnit: cpu, margin: round2(l.revenue - cpu * qty) });
  });

  let material = 0;
  let laborTotal = 0;
  let m2WithMatch = 0;
  let pricedRevenue = 0;
  let hasMatch = false;

  const newLines: QuotationLine[] = lines.map((l, i) => {
    const extra = extraLines.get(i);
    if (extra) return extra;
    const rates = ratesForLine(l, costs);
    const special = override?.prices[l.code.toLowerCase()];
    // Volgorde: handmatige correctie op deze offerte, dan de prijslijst, dan wat
    // er bij de sync is berekend.
    const purchase = special ?? purchaseForLine(l, config) ?? l.purchasePerM2 ?? null;
    const labor = override?.noLabor ? 0 : rates.labor;

    if (purchase == null) {
      return { ...l, margin: null, underlayPerM2: rates.underlay, laborPerM2: labor };
    }
    material += (purchase + rates.underlay) * l.m2;
    laborTotal += labor * l.m2;
    m2WithMatch += l.m2;
    pricedRevenue += l.revenue;
    hasMatch = true;
    return {
      ...l,
      margin: round2(l.revenue - (purchase + rates.underlay + labor) * l.m2),
      purchasePerM2: purchase,
      underlayPerM2: rates.underlay,
      laborPerM2: labor,
    };
  });

  const floorMatch = hasMatch && m2WithMatch > 0;
  if (!floorMatch && !extraPriced) {
    return { ...basis, lines: newLines, cost: null, margin: null, marginPct: null, verified: false };
  }
  if (!floorMatch) {
    // Alleen overige producten met een kostprijs, bv. een losse traprenovatie.
    const margin = round2(extraRevenue - extraCost);
    return {
      ...basis,
      lines: newLines,
      cost: round2(extraCost),
      margin,
      marginPct: extraRevenue > 0 ? round1((margin / extraRevenue) * 100) : null,
      matchCoverage: null,
      verified: false,
    };
  }

  const cost = material + laborTotal;
  // Naar rato (sinds 2026-10-20). Eerst: de héle vloeromzet min alleen de
  // kosten van de beprijsde regels — een regel zonder inkoopprijs telde dan als
  // pure winst, en een offerte met 40% beprijsde m² kwam op 76% marge uit.
  // Nu: de marge van de beprijsde regels, als percentage doorgetrokken over de
  // hele vloeromzet. Bij volledige dekking verandert er niets.
  const floorMargin =
    pricedRevenue > 0 && pricedRevenue < basis.omzetVloer
      ? ((pricedRevenue - cost) / pricedRevenue) * basis.omzetVloer
      : basis.omzetVloer - cost;
  // Overige producten tellen alleen mee als ze een kostprijs hebben — zonder
  // kostprijs staan ze er niet in, net zo min als hun omzet in de noemer.
  const margin = round2(floorMargin + extraRevenue - extraCost);
  const base = basis.omzetVloer + extraRevenue;
  const marginPct = base > 0 ? round1((margin / base) * 100) : null;
  const matchCoverage = basis.totalM2 > 0 ? round1((m2WithMatch / basis.totalM2) * 100) : null;
  return {
    ...basis,
    lines: newLines,
    cost: round2(cost + extraCost),
    margin,
    marginPct,
    matchCoverage,
    verified: matchCoverage === 100,
  };
}

/**
 * Alle offertes doorrekenen. Prijsconfiguratie en kostentarieven worden per
 * datum gecachet: 843 offertes delen een paar honderd unieke datums, en zonder
 * cache zou elke render de hele prijslijst honderden keren opnieuw sorteren.
 */
export function resolveQuotations(rows: QuotationRow[], input: ResolveInput): QuotationRow[] {
  const { prices, costs, overrides } = input;
  const configCache = new Map<string, PriceConfig>();
  const costCache = new Map<string, ReturnType<typeof costsForDate>>();

  const resolved = rows.map((q) => {
    const date = priceDate(q);
    let config = configCache.get(date);
    if (!config) {
      config = priceConfigForDate(prices, date);
      configCache.set(date, config);
    }
    let rates = costCache.get(date);
    if (!rates) {
      rates = costsForDate(costs, date, COST_FALLBACK);
      costCache.set(date, rates);
    }
    return recompute(q, config, rates, overrides?.[q.id]);
  });
  const won = applyInvoiceWins(resolved, input);
  return addInvoiceExtras(rows, won, input, (q, extra) => {
    const date = priceDate(q);
    return recompute(q, configCache.get(date) ?? priceConfigForDate(prices, date), costCache.get(date) ?? costsForDate(costs, date, COST_FALLBACK), overrides?.[q.id], extra);
  });
}

/**
 * Nacalculatie (Jan, 2026-11-05): "Plinten worden op de offerte vaak op
 * nacalculatie aangeboden en pas op de factuur berekend." Op de offerte staat
 * de plint dan met €0, op de eindfactuur met het echte aantal meters.
 *
 * Per deal en per code: wat er op de facturen méér staat dan op de offerte, komt
 * als extra regel bij de geaccepteerde offerte van die deal (bij meerdere: de
 * grootste), met omzet en al. Staat de plint al met bedrag op de offerte, dan
 * staat hij ook op de factuur en is het verschil nul — er telt niets dubbel.
 * Minder gefactureerd dan geoffreerd (een aanbetaling zonder regels, een
 * restantfactuur) laten we liggen: dat is geen nacalculatie. En het totaal
 * blijft binnen wat er per deal méér gefactureerd is dan de offerte.
 */
const NACALC_MIN = 1; // euro; afrondingsverschillen zijn geen nacalculatie

function addInvoiceExtras(
  raw: QuotationRow[],
  won: QuotationRow[],
  input: ResolveInput,
  rerun: (q: QuotationRow, extra: QuotationLine[]) => QuotationRow,
): QuotationRow[] {
  const perDeal = input.invoiceExtras;
  if (!perDeal || Object.keys(perDeal).length === 0) return won;

  const doel = new Map<string, QuotationRow>(); // dealId -> geaccepteerde offerte
  for (const q of won) {
    if (q.status !== 'accepted' || !q.dealId || q.deletedAtSource || !perDeal[q.dealId]) continue;
    const cur = doel.get(q.dealId);
    if (!cur || q.revenueExVat > cur.revenueExVat) doel.set(q.dealId, q);
  }
  if (doel.size === 0) return won;

  const rawById = new Map(raw.map((q) => [q.id, q]));
  const extraPerId = new Map<string, QuotationLine[]>();
  for (const [deal, q] of doel) {
    const geoffreerd = new Map<string, { qty: number; revenue: number }>();
    for (const l of q.lines ?? []) {
      if (l.kind !== 'extra') continue;
      const e = geoffreerd.get(l.code) ?? { qty: 0, revenue: 0 };
      e.qty += l.qty ?? 0;
      e.revenue += l.revenue;
      geoffreerd.set(l.code, e);
    }
    const regels: QuotationLine[] = [];
    for (const f of perDeal[deal]) {
      const o = geoffreerd.get(f.code) ?? { qty: 0, revenue: 0 };
      const revenue = round2(f.revenue - o.revenue);
      if (revenue < NACALC_MIN) continue;
      regels.push({
        code: f.code,
        kind: 'extra',
        unit: f.unit,
        qty: Math.max(0, round2(f.qty - o.qty)),
        revenue,
        m2: 0,
        margin: null,
        desc: 'Nacalculatie (gefactureerd, niet op de offerte)',
        source: 'factuur',
      });
    }
    if (regels.length === 0) continue;
    // Nacalculatie maakt de factuur hoger dan de offerte; meer dan dat verschil
    // kan het dus nooit zijn. Gemeten 2026-11-05: bij 19 van de 116 offertes was
    // er nauwelijks of minder gefactureerd dan geoffreerd — de plint zat dan in
    // een andere offerteregel, of heette op de factuur anders ("overzettreden"
    // tegen "dichte trap"). Zonder deze grens telde dat €12,5k dubbel.
    const ruimte = (input.invoicedPerDeal?.[deal] ?? 0) - q.revenueExVat;
    const totaal = regels.reduce((t, l) => t + l.revenue, 0);
    if (ruimte < NACALC_MIN) continue;
    const factor = Math.min(1, ruimte / totaal);
    extraPerId.set(
      q.id,
      factor < 1
        ? regels.map((l) => ({ ...l, qty: round2((l.qty ?? 0) * factor), revenue: round2(l.revenue * factor) }))
        : regels,
    );
  }
  if (extraPerId.size === 0) return won;

  return won.map((q) => {
    const regels = extraPerId.get(q.id);
    const bron = rawById.get(q.id);
    if (!regels || !bron) return q;
    const opnieuw = rerun(bron, regels);
    // Status en beslisdatum komen uit de eerste ronde (gefactureerd = gewonnen).
    return {
      ...opnieuw,
      status: q.status,
      sourceStatus: q.sourceStatus,
      wonByInvoice: q.wonByInvoice,
      dateAccepted: q.dateAccepted,
      month: q.month,
      quarter: q.quarter,
      year: q.year,
    };
  });
}

/**
 * Gefactureerd = gewonnen. 73 offertes stonden op 'verlopen' terwijl er op hun
 * deal gefactureerd was (gemeten 2026-10-20): de klant zei ja, maar niemand zette
 * de offerte in Teamleader op geaccepteerd. Ze telden als verloren, en dat
 * drukte de conversie, de winkans en de cijfers op Verloren.
 *
 * Per deal met facturen en zonder geaccepteerde offerte wordt één versie
 * gewonnen: die waarvan het bedrag het dichtst bij het gefactureerde ligt (een
 * deal heeft vaak meerdere offerteversies). Als beslisdatum de datum waarop de
 * deal in Teamleader gewonnen is, anders de eigen beslisdatum van de offerte.
 * Een handmatig gezette status (veldcorrectie) gaat altijd vóór.
 */
function applyInvoiceWins(rows: QuotationRow[], input: ResolveInput): QuotationRow[] {
  const gefactureerd = input.invoicedPerDeal;
  if (!gefactureerd) return rows;
  const perDeal = new Map<string, QuotationRow[]>();
  for (const q of rows) {
    if (!q.dealId || q.deletedAtSource) continue;
    (perDeal.get(q.dealId) ?? perDeal.set(q.dealId, []).get(q.dealId)!).push(q);
  }
  const winnaar = new Set<string>();
  for (const [deal, qs] of perDeal) {
    const totaal = gefactureerd[deal];
    if (!totaal || totaal <= 0) continue;
    if (qs.some((q) => q.status === 'accepted')) continue;
    const kandidaten = qs.filter((q) => !input.overrides?.[q.id]?.fields?.status);
    if (kandidaten.length === 0) continue;
    const best = [...kandidaten].sort(
      (a, b) => Math.abs(a.revenueExVat - totaal) - Math.abs(b.revenueExVat - totaal) || b.dateCreated.localeCompare(a.dateCreated),
    )[0];
    winnaar.add(best.id);
  }
  if (winnaar.size === 0) return rows;
  return rows.map((q) => {
    if (!winnaar.has(q.id)) return q;
    const dateAccepted = input.dealWonAt?.[q.dealId] || q.dateAccepted || q.dateCreated;
    return {
      ...q,
      status: 'accepted',
      sourceStatus: q.status,
      wonByInvoice: true,
      dateAccepted,
      ...deriveDateParts(dateAccepted),
    };
  });
}

/**
 * Een gecachete snapshot opnieuw opbouwen met de doorgerekende offertes, zodat
 * ook de eerste weergave klopt.
 */
export function resolveSnapshot(snapshot: Snapshot, input: ResolveInput): Snapshot {
  const q = resolveQuotations(snapshot.quotations, input);
  const lines: AggLine[] = q.flatMap((x) =>
    (x.lines ?? []).map((l) => ({ ...l, status: x.status, quotationId: x.id })),
  );
  return buildSnapshot(
    q,
    snapshot.runTimeRows,
    lines,
    snapshot.invoicing,
    snapshot.lookbackDays,
    snapshot.generatedAt,
  );
}
