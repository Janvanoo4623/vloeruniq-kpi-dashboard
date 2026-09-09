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
import type { QuotationLine, QuotationOverride, QuotationRow, Snapshot } from './types';

const round2 = (v: number) => Math.round(v * 100) / 100;
const round1 = (v: number) => Math.round(v * 10) / 10;

const P_NUMBER = /^P\d{3}$/i;

export interface ResolveInput {
  prices: PriceRow[];
  costs: CostRow[];
  overrides: Record<string, QuotationOverride>;
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

/** Eén offerte doorrekenen tegen de prijzen en kosten van zijn eigen datum. */
function recompute(
  q: QuotationRow,
  config: PriceConfig,
  costs: { alwaysPerM2: number; gluedPerM2: number; selfAdhesivePerM2: number },
  override: QuotationOverride | undefined,
): QuotationRow {
  const lines = q.lines ?? [];
  if (lines.length === 0) return q;

  let material = 0;
  let laborTotal = 0;
  let m2WithMatch = 0;
  let hasMatch = false;

  const newLines: QuotationLine[] = lines.map((l) => {
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
    hasMatch = true;
    return {
      ...l,
      margin: round2(l.revenue - (purchase + rates.underlay + labor) * l.m2),
      purchasePerM2: purchase,
      underlayPerM2: rates.underlay,
      laborPerM2: labor,
    };
  });

  if (!hasMatch || m2WithMatch <= 0) {
    return { ...q, lines: newLines, cost: null, margin: null, marginPct: null, verified: false };
  }

  const cost = material + laborTotal;
  const margin = round2(q.omzetVloer - cost);
  const marginPct = q.omzetVloer > 0 ? round1((margin / q.omzetVloer) * 100) : null;
  const matchCoverage = q.totalM2 > 0 ? round1((m2WithMatch / q.totalM2) * 100) : null;
  return {
    ...q,
    lines: newLines,
    cost: round2(cost),
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

  return rows.map((q) => {
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
