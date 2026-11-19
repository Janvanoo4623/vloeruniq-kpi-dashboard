// Planning-Sheet: van een geaccepteerde offerte naar de rijen die Jan nu met de
// hand overtypt in "Planning '26" (kolommen G t/m M, zie docs/PLANNING-SHEET.md).
//
// Waarom hier en niet in n8n. De herkenning van vloer, legservice en overige
// producten is in deze repo getoetst op alle echte regelteksten (lib/extras.ts,
// lib/teamleader/matching.ts). n8n haalt de offerte met zijn eigen
// Teamleader-token op en vraagt hier de rijen kant-en-klaar op, zodat er geen
// tweede, ongetoetste versie van die regels ontstaat.
//
// Waarom de RUWE offerteregels en niet de opgeslagen offerte. Twee redenen,
// allebei gevonden door de uitkomst naast Jans echte Sheet te leggen (2026-11-19):
// - Plint staat vaak met €0 op de offerte ("op nacalculatie"). De sync bewaart
//   alleen regels met een bedrag, dus de plint ontbrak in kolom M.
// - De webhook komt binnen op het moment van akkoord; de sync draait pas later.
//   De opgeslagen offerte bestaat dan nog niet.
//
// Zuiver: geen database, geen Teamleader.
import { classifyExtra, type ExtraUnit } from './extras';
import { isFloorLine, laborRuleOf } from './teamleader/matching';

/** Eén regel zoals Teamleader hem geeft (quotations.info → grouped_lines[].line_items[]). */
export interface PlanningLineInput {
  description: string;
  quantity: number;
  /** Regelbedrag ex btw vóór korting (total.tax_exclusive.amount). */
  amount: number;
}

export interface PlanningInput {
  naam: string;
  plaats: string;
  lines: PlanningLineInput[];
}

export interface PlanningFloor {
  /** Kolom J: m² incl. snijverlies. Leeg (null) als de vloer zonder legservice is. */
  m2: number | null;
  /**
   * Kolom K. Jan zet hier de m² van een vloer zonder legservice, "zodat ze onderaan
   * niet met het totaal meegaan". Verdiepingen vult de planner zelf in.
   */
  k: string;
  /** Kolom L: de productnaam, het stuk vóór de eerste "|". */
  vloer: string;
}

export interface PlanningJob {
  naam: string;
  plaats: string;
  /** Eén rij per vloerregel; de eerste rij krijgt naam, telefoon en plaats. */
  floors: PlanningFloor[];
  /** Kolom M: plint, trap en mat in één cel, gescheiden door " | ". */
  plintTrapMat: string;
  /** Dezelfde onderdelen los, voor de oude indeling met drie kolommen. */
  parts: { kind: 'plint' | 'trap' | 'mat'; text: string }[];
  /**
   * Werk dat geen vloer, plint, trap of mat is maar wel gepland moet worden
   * (sleuven dichtzetten, vloerverwarming, kurkstuc). Jan zet dat nu in
   * Opmerkingen (F); die kolom is van de planner, dus n8n schrijft hem niet.
   */
  overigWerk: string[];
}

const head = (desc: string): string => desc.split('|')[0].replace(/\s+/g, ' ').trim();

const num = (n: number): string => (Math.round(n * 100) / 100).toLocaleString('nl-NL');

/** Codes die in kolom M horen. Tapijt is werk per m² en krijgt een eigen vloerrij. */
const IN_M = /^(plinten|traprenovatie|entreemat)/i;
const CARPET = /^tapijt/i;
/** Ander werk dat in de planning thuishoort (gemeten op de regelteksten, docs/DATA-MODEL.md). */
const OTHER_WORK = /^(sleuven|dichtzetten sleuven)|vloerverwarming|\bfrezen\b|kurkstuc|korqstuc|beton ?cir|^fermacell/i;

function extraText(desc: string, code: string, unit: ExtraUnit, q: number): string {
  const h = head(desc) || code;
  switch (unit) {
    case 'm1':
      return q > 0 ? `${num(q)}m1 ${h}` : h;
    case 'lengte':
      return q > 0 ? `${num(q)} lengtes ${h}` : h;
    case 'trede':
      return q > 0 ? `${h} (${num(q)} treden)` : h;
    case 'trap':
      return q > 1 ? `${num(q)}x ${h}` : h;
    case 'm2':
      return q > 0 ? `${num(q)}m² ${h}` : h;
    default:
      return q > 1 ? `${num(q)}x ${h}` : h;
  }
}

/**
 * De planningsrijen voor één offerte: één rij per vloerregel, in de volgorde van
 * de offerte. Bewust NIET samengevoegd: een offerte zet dezelfde vloer per
 * verdieping op een eigen regel (46 + 46 m² P530), en Jan maakt daar ook twee
 * rijen van met BG/1e in kolom K. Samenvoegen gaf in de vergelijking met de echte
 * Sheet vaker een verschil dan het oploste.
 */
export function planningJob(input: PlanningInput): PlanningJob {
  const rows: PlanningFloor[] = [];
  const add = (vloer: string, m2: number, loose: boolean) =>
    rows.push(loose ? { m2: null, k: num(m2), vloer } : { m2: Math.round(m2 * 100) / 100, k: '', vloer });
  const m: { kind: 'plint' | 'trap' | 'mat'; text: string }[] = [];
  const overig: string[] = [];
  // Plint staat soms twee keer: met aantal en nog eens met €0 en aantal 0.
  const metAantal = new Set(
    input.lines.filter((l) => (l.quantity ?? 0) > 0).map((l) => head(l.description ?? '').toLowerCase()),
  );

  for (const l of input.lines) {
    const desc = (l.description ?? '').trim();
    const qty = l.quantity ?? 0;
    // Een negatieve regel is korting, nooit een product.
    if (!desc || l.amount < 0) continue;

    // Ook regels van €0: plint "op nacalculatie" moet wel gepland worden.
    const extra = classifyExtra(desc, qty, l.amount);
    if (extra) {
      const q = extra.quantity ?? qty;
      if (q === 0 && metAantal.has(head(desc).toLowerCase())) continue;
      if (IN_M.test(extra.code))
        m.push({
          kind: /^plint/i.test(extra.code) ? 'plint' : /^trap/i.test(extra.code) ? 'trap' : 'mat',
          text: extraText(desc, extra.code, extra.unit, q),
        });
      else if (CARPET.test(extra.code) && extra.unit === 'm2' && q > 0) add(head(desc), q, false);
      else if (/verwijder/i.test(extra.code)) overig.push(q > 1 ? `${num(q)} × ${head(desc)}` : head(desc));
      continue;
    }
    if (isFloorLine(desc)) {
      if (qty > 0) add(head(desc), qty, laborRuleOf(desc) === 'excluded');
      continue;
    }
    if (OTHER_WORK.test(desc) && (l.amount > 0 || qty > 0)) overig.push(qty > 1 ? `${num(qty)} × ${head(desc)}` : head(desc));
  }

  return {
    naam: input.naam.trim(),
    plaats: input.plaats.trim(),
    floors: rows,
    plintTrapMat: m.map((x) => x.text).join(' | '),
    parts: m,
    overigWerk: overig,
  };
}

// ── Waar in de Sheet ────────────────────────────────────────────────────

/** Tabnamen zoals ze in "Planning '26" staan. Let op: "Sept", "Mrt", "Mei", "Okt". */
const MAANDEN = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sept', 'Okt', 'Nov', 'Dec'];

/**
 * Drie kolomindelingen (docs/PLANNING-SHEET.md, "Echte indeling"):
 * - `maand`: Jul 26 t/m Dec 26. A–E dagen, F opmerkingen, G–M automatisch, M = plint/trap/mat samen.
 * - `oud`: Jan–Jun 26 en de tab 2027. Plint, trap en mat in drie kolommen.
 * - `geenDatum`: de tab "Geen datum", de oude indeling twee kolommen naar links.
 */
export type SheetLayout = 'maand' | 'oud' | 'geenDatum';

interface Columns {
  naam: string;
  tel: string;
  plaats: string;
  m2: string;
  k: string;
  vloer: string;
  m?: string;
  plint?: string;
  trap?: string;
  mat?: string;
}

export const SHEET_COLUMNS: Record<SheetLayout, Columns> = {
  maand: { naam: 'G', tel: 'H', plaats: 'I', m2: 'J', k: 'K', vloer: 'L', m: 'M' },
  oud: { naam: 'D', tel: 'E', plaats: 'F', m2: 'G', k: 'H', vloer: 'I', plint: 'J', trap: 'K', mat: 'L' },
  geenDatum: { naam: 'C', tel: 'D', plaats: 'E', m2: 'F', k: 'G', vloer: 'H', plint: 'I', trap: 'J', mat: 'K' },
};

export interface SheetTarget {
  tab: string;
  /**
   * Het blok waaronder de klus komt (tekst in kolom A), of null voor de eerste
   * lege rij onder de kop. "Overig" is waar Jan een klus zonder vaste week zet.
   */
  block: string | null;
  layout: SheetLayout;
}

/**
 * Waar een klus komt. Besluit 2026-11-19 (geen vraag aan Jan, de Sheet zegt het
 * zelf): datum uitvoering in 2026 → het Overig-blok van die maandtab; in 2027 →
 * tab "2027"; geen of een latere datum → tab "Geen datum".
 */
export function planningTarget(datumUitvoering: string | null | undefined): SheetTarget {
  const m = /^(\d{4})-(\d{2})/.exec(datumUitvoering ?? '');
  const jaar = m ? Number(m[1]) : 0;
  const maand = m ? Number(m[2]) : 0;
  if (jaar === 2026 && maand >= 1 && maand <= 12)
    return { tab: `${MAANDEN[maand - 1]} 26`, block: 'Overig', layout: maand >= 7 ? 'maand' : 'oud' };
  if (jaar === 2027) return { tab: '2027', block: 'Overig', layout: 'oud' };
  return { tab: 'Geen datum', block: null, layout: 'geenDatum' };
}

/**
 * De cellen per rij, als { kolomletter: waarde }. De eerste rij krijgt naam,
 * telefoon, plaats en plint/trap/mat; de volgende rijen alleen m², K en vloer,
 * zoals Jan nu doet. Een klus zonder vloer krijgt één rij zonder m².
 */
export function sheetRows(job: PlanningJob, telefoon: string, layout: SheetLayout): Record<string, string | number>[] {
  const c = SHEET_COLUMNS[layout];
  const floors = job.floors.length ? job.floors : [{ m2: null, k: '', vloer: '' }];
  return floors.map((f, i) => {
    const row: Record<string, string | number> = {};
    if (i === 0) {
      row[c.naam] = job.naam;
      if (telefoon) row[c.tel] = `Tel: ${telefoon}`;
      row[c.plaats] = job.plaats;
      if (c.m) {
        if (job.plintTrapMat) row[c.m] = job.plintTrapMat;
      } else {
        for (const kind of ['plint', 'trap', 'mat'] as const) {
          const t = job.parts.filter((p) => p.kind === kind).map((p) => p.text).join(' | ');
          if (t) row[c[kind]!] = t;
        }
      }
    }
    if (f.m2 != null) row[c.m2] = f.m2;
    if (f.k) row[c.k] = f.k;
    if (f.vloer) row[c.vloer] = f.vloer;
    return row;
  });
}

/** Teamleader quotations.info → de regels die planningJob verwacht. */
export function linesFromQuotation(detail: {
  grouped_lines?: { line_items?: { description?: string; quantity?: number; total?: { tax_exclusive?: { amount?: number } } }[] }[];
}): PlanningLineInput[] {
  return (detail.grouped_lines ?? []).flatMap((g) =>
    (g.line_items ?? []).map((it) => ({
      description: it.description ?? '',
      quantity: it.quantity ?? 0,
      amount: it.total?.tax_exclusive?.amount ?? 0,
    })),
  );
}
