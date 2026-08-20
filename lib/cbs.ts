// CBS StatLine — verhuisde personen per gemeente per maand (tabel 84547NED).
//
// Waarom deze bron: wie verhuist koopt een vloer. Dit is de vraagkant van de
// markt, per gemeente, per maand — en het is de enige externe bron die zich
// laat koppelen aan wat we zelf al hebben (de plaats op de offerte).
//
// Open data, geen sleutel nodig, OData v3. De reeks loopt met ongeveer twee
// maanden vertraging: in augustus 2026 is juni 2026 de laatste maand. Dat is te
// traag om op te sturen, maar ruim genoeg om marktaandeel per gemeente te meten.
//
// Geverifieerd op 2026-08-20: alle gemeenten waar Vloeruniq werkt zitten erin,
// inclusief de samengevoegde gemeente Rijssen-Holten (GM1742).

const BASE = 'https://opendata.cbs.nl/ODataApi/OData/84547NED';
const TOTAAL_GESLACHT = 'T001038';
const ALLE_LEEFTIJDEN = '10000';

export interface CbsMove {
  period: string; // YYYY-MM
  /** Binnen de gemeente verhuisd — dit zijn de klanten die in de buurt blijven. */
  within: number;
  /** Van buiten de gemeente gevestigd — nieuwe inwoners. */
  arrived: number;
  /** Uit de gemeente vertrokken. */
  left: number;
  /** Totale verhuisbeweging die tot vloervraag kan leiden. */
  demand: number;
}

export interface CbsRegion {
  key: string; // GM0141
  title: string; // Almelo
}

/**
 * Plaatsnaam → CBS-gemeentecode. Vloeruniq offreert per plaats, CBS meet per
 * gemeente, en die twee lopen niet gelijk: Holten en Rijssen zijn sinds 2001 één
 * gemeente (Rijssen-Holten), en Bathmen hoort bij Deventer. Zonder deze vertaling
 * vergelijk je appels met peren.
 *
 * Alleen de plaatsen waar daadwerkelijk omzet vandaan komt; de rest valt terug op
 * een naam-match tegen de CBS-regiolijst.
 */
export const PLAATS_NAAR_GEMEENTE: Record<string, string> = {
  rijssen: 'GM1742', // Rijssen-Holten
  holten: 'GM1742', // idem — sinds 2001 dezelfde gemeente
  bathmen: 'GM0150', // opgegaan in Deventer
  deventer: 'GM0150',
  almelo: 'GM0141',
  hengelo: 'GM0164', // Hengelo (O.), niet Hengelo (Gld.)
  wierden: 'GM0189',
  enschede: 'GM0153',
  raalte: 'GM0177',
  nijverdal: 'GM0163', // gemeente Hellendoorn — NIET Twenterand, dat is de buurgemeente
  hellendoorn: 'GM0163',
  goor: 'GM1735', // Hof van Twente
  markelo: 'GM1735',
  delden: 'GM1735',
  borne: 'GM0147',
  oldenzaal: 'GM0173',
  lochem: 'GM0262',
  enter: 'GM0189', // hoort bij Wierden
  zwolle: 'GM0193',
  olst: 'GM1773', // Olst-Wijhe
  wijhe: 'GM1773',
  ommen: 'GM0175',
  hardenberg: 'GM0160',
  haaksbergen: 'GM0158',
  losser: 'GM0168',
  dinkelland: 'GM1774',
  tubbergen: 'GM0183',
  twenterand: 'GM1700',
  vriezenveen: 'GM1700', // Vriezenveen ligt in Twenterand
  apeldoorn: 'GM0200',
  zutphen: 'GM0301',
};

interface CbsRow {
  Perioden?: string;
  BinnenGemeentenVerhuisdePersonen_1?: number | null;
  GevestigdInDeGemeente_2?: number | null;
  VertrokkenUitDeGemeente_3?: number | null;
}

/** "2026MM06" → "2026-06"; kwartaal- en jaarrijen geven null. */
function toMonth(perioden: string): string | null {
  const m = perioden.trim().match(/^(\d{4})MM(\d{2})$/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * Haal de maandreeks voor één gemeente op vanaf `fromPeriod` (bv. "2024MM01").
 * Gooit bij een fout — de aanroeper beslist of dat de pagina mag breken. Zie
 * `fetchMovesSafe` voor de variant die stilletjes teruggeeft wat er is.
 */
export async function fetchMoves(
  gemeenteCode: string,
  fromPeriod = '2024MM01',
): Promise<CbsMove[]> {
  const filter = [
    `RegioS eq '${gemeenteCode}'`,
    `Geslacht eq '${TOTAAL_GESLACHT}'`,
    `Leeftijd31December eq '${ALLE_LEEFTIJDEN}'`,
    `Perioden ge '${fromPeriod}'`,
  ].join(' and ');

  const url = `${BASE}/TypedDataSet?$filter=${encodeURIComponent(filter)}`;
  const res = await fetch(url, {
    // CBS werkt maandelijks bij; een dag cache is ruim voldoende en houdt de
    // dashboardpagina snel.
    next: { revalidate: 86400 },
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`CBS ${gemeenteCode}: HTTP ${res.status}`);

  const body = (await res.json()) as { value?: CbsRow[] };
  const out: CbsMove[] = [];
  for (const r of body.value ?? []) {
    const period = toMonth(r.Perioden ?? '');
    if (!period) continue;
    const within = r.BinnenGemeentenVerhuisdePersonen_1 ?? 0;
    const arrived = r.GevestigdInDeGemeente_2 ?? 0;
    const left = r.VertrokkenUitDeGemeente_3 ?? 0;
    out.push({ period, within, arrived, left, demand: within + arrived });
  }
  return out.sort((a, b) => a.period.localeCompare(b.period));
}

/** Zoals fetchMoves, maar geeft een lege reeks terug als CBS niet bereikbaar is. */
export async function fetchMovesSafe(
  gemeenteCode: string,
  fromPeriod?: string,
): Promise<CbsMove[]> {
  try {
    return await fetchMoves(gemeenteCode, fromPeriod);
  } catch {
    return [];
  }
}

/** Gemeentecode voor een (al genormaliseerde) plaatsnaam, of null. */
export function gemeenteCodeVoor(plaats: string): string | null {
  return PLAATS_NAAR_GEMEENTE[plaats.trim().toLowerCase()] ?? null;
}

/** Alle regio's uit CBS als code → naam. Voor het labelen van gemeenten. */
export async function fetchRegionNames(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${BASE}/RegioS`, {
      next: { revalidate: 604800 }, // gemeentenamen wijzigen hoogstens jaarlijks
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return {};
    const body = (await res.json()) as { value?: { Key?: string; Title?: string }[] };
    const out: Record<string, string> = {};
    for (const r of body.value ?? []) {
      if (r.Key) out[r.Key.trim()] = r.Title ?? r.Key.trim();
    }
    return out;
  } catch {
    return {};
  }
}

/** De maandreeksen voor alle gemeenten in de vertaaltabel, parallel opgehaald. */
export async function fetchAllMoves(fromPeriod = '2025MM01'): Promise<Record<string, CbsMove[]>> {
  const codes = [...new Set(Object.values(PLAATS_NAAR_GEMEENTE))];
  const paren = await Promise.all(
    codes.map(async (code) => [code, await fetchMovesSafe(code, fromPeriod)] as const),
  );
  return Object.fromEntries(paren);
}
