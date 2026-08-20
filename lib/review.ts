// De werklijst: alles wat de app niet zélf kan vaststellen en dus aan een mens
// moet vragen. Het uitgangspunt is dat een onzekerheid zichtbaar hoort te zijn
// in plaats van te verdwijnen in een KPI — een geraden aanname die als feit in
// de cijfers belandt is precies wat we niet meer willen.
import type { InstallMode, QuotationOverride, QuotationRow } from './types';

/** Eén offerteregel waarvan de tekst niets zegt over leggen. */
export interface ReviewLine {
  code: string;
  desc: string;
  m2: number;
  revenue: number;
  pricePerM2: number | null;
  laborPerM2: number;
  installMode?: InstallMode;
}

export interface ReviewItem {
  id: string;
  name: string;
  customerName: string;
  status: QuotationRow['status'];
  date: string;
  revenueExVat: number;
  margin: number | null;
  marginPct: number | null;
  lines: ReviewLine[];
  /** Arbeid die op het spel staat als dit tóch een losse verkoop blijkt. */
  laborAtStake: number;
  /** Afgehandeld doordat 'los verkocht' is aangezet — de cijfers zijn aangepast. */
  resolved: boolean;
  /** Afgehandeld doordat een mens 'klopt zo' aanvinkte — cijfers ongewijzigd. */
  reviewed: boolean;
  /** Wat we op grond van de gemeten kenmerken vermoeden. */
  hint: 'likely-loose' | 'likely-installed' | null;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Bovengrens van de prijzen waarbij het leggen aantoonbaar NIET was inbegrepen.
 * Gemeten over de 19 regels die het expliciet uitsluiten: €21 tot €35, mediaan
 * €27. Regels met inbegrepen leggen zitten daar duidelijk boven (mediaan €51).
 * Ligt een onbekende regel onder deze grens, dan is losse levering waarschijnlijk.
 */
export const SUPPLY_ONLY_MAX_PER_M2 = 35;

/**
 * Zegt de prijs iets over deze regel? Alleen voor klik-vloeren: gelijmd werk is
 * per definitie vakwerk (egaliseren + lijmen doe je niet zelf), en van de 512
 * gemeten regels is er geen enkele gelijmde regel ooit zonder legservice
 * verkocht. Dat is een hint voor de mens, geen automatische conclusie.
 */
export function supplyOnlyHint(l: ReviewLine): 'likely-loose' | 'likely-installed' | null {
  if (l.installMode === 'glued') return 'likely-installed';
  if (l.pricePerM2 != null && l.pricePerM2 > 0 && l.pricePerM2 <= SUPPLY_ONLY_MAX_PER_M2) {
    return 'likely-loose';
  }
  return null;
}

/**
 * Offertes met minstens één vloerregel waarvan de omschrijving niet zegt of het
 * leggen erbij zit. Die regels krijgen wél arbeid — dat is de veiligste aanname
 * — maar komen hier op de lijst zodat iemand het kan bevestigen of met één klik
 * op "los verkocht" kan zetten. Grootste bedrag eerst: daar zit het risico.
 */
export function computeReviewList(
  quotations: QuotationRow[],
  overrides: Record<string, QuotationOverride> = {},
  reviewedIds: Set<string> = new Set(),
): ReviewItem[] {
  const items: ReviewItem[] = [];

  for (const q of quotations) {
    const unclear = (q.lines ?? []).filter((l) => l.laborRule === 'unknown');
    if (unclear.length === 0) continue;

    const ov = overrides[q.id];
    const lines: ReviewLine[] = unclear.map((l) => ({
      code: l.code,
      desc: l.desc ?? '',
      m2: l.m2,
      revenue: l.revenue,
      pricePerM2: l.m2 > 0 ? round2(l.revenue / l.m2) : null,
      laborPerM2: l.laborPerM2 ?? 0,
      installMode: l.installMode,
    }));

    items.push({
      id: q.id,
      name: q.name,
      customerName: q.customerName,
      status: q.status,
      date: q.dateAccepted || q.dateCreated,
      revenueExVat: q.revenueExVat,
      margin: q.margin,
      marginPct: q.marginPct,
      lines,
      laborAtStake: round2(lines.reduce((s, l) => s + l.laborPerM2 * l.m2, 0)),
      // Een aangevinkte "los verkocht" is een uitspraak over precies deze vraag;
      // een losse prijscorrectie zegt er niets over en telt dus niet als antwoord.
      resolved: Boolean(ov?.noLabor),
      reviewed: reviewedIds.has(q.id),
      hint: strongestHint(lines),
    });
  }

  // Onafgehandeld eerst, en daarbinnen wat er waarschijnlijk fout is bovenaan:
  // dat is de volgorde waarin je de lijst wilt aflopen.
  const rang = (i: ReviewItem) =>
    i.resolved || i.reviewed ? 2 : i.hint === 'likely-loose' ? 0 : 1;
  return items.sort((a, b) => {
    const r = rang(a) - rang(b);
    return r !== 0 ? r : b.laborAtStake - a.laborAtStake;
  });
}

/** Het sterkste signaal van alle regels; 'gelijmd' weegt zwaarder dan een prijs. */
function strongestHint(lines: ReviewLine[]): 'likely-loose' | 'likely-installed' | null {
  const hints = lines.map(supplyOnlyHint);
  if (hints.includes('likely-installed')) return 'likely-installed';
  if (hints.includes('likely-loose')) return 'likely-loose';
  return null;
}
