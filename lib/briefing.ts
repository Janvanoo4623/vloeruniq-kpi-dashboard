// De ochtendbriefing: drie à vier gewone zinnen bovenaan Overzicht.
//
// Geen AI. Elke zin komt uit een vaste regel met een drempel, zodat hij elke
// dag hetzelfde betekent en je hem kunt vertrouwen: "loopt achter" zegt het
// dashboard alleen als het echt achterloopt. Getallen staan tussen **…** en
// worden vet gezet.
import { formatEuro, formatPercent } from './format';
import type { BreakEven, MonthProgress } from './today';

const MAAND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const maandNaam = (m: string) => MAAND[Number(m.slice(5, 7)) - 1];
const vorigeMaand = (m: string) => {
  const y = Number(m.slice(0, 4));
  const mm = Number(m.slice(5, 7));
  return mm === 1 ? `${y - 1}-12` : `${y}-${String(mm - 1).padStart(2, '0')}`;
};

export interface BriefingInput {
  month: MonthProgress;
  breakEven: BreakEven | null;
  /** Gemiddelde marge % in de gekozen periode en de periode ervoor. */
  marginPct: number | null;
  prevMarginPct: number | null;
  overdue: { amount: number; count: number };
}

export function buildBriefing(i: BriefingInput): string[] {
  const zinnen: string[] = [];
  const { month: m } = i;
  const naam = maandNaam(m.month);
  const vorige = maandNaam(vorigeMaand(m.month));

  // 1. De maand tot nu toe, tegenover vorige maand op dezelfde dag.
  const ref = m.prevSameDay.revenue;
  let tempo = '';
  if (ref > 0) {
    const verschil = (m.revenue - ref) / ref;
    tempo =
      verschil > 0.1
        ? ` — **${formatPercent(Math.round(verschil * 100))} meer** dan ${vorige} op dezelfde dag`
        : verschil < -0.1
          ? ` — **${formatPercent(Math.round(-verschil * 100))} minder** dan ${vorige} op dezelfde dag (${formatEuro(ref)})`
          : ` — ongeveer gelijk aan ${vorige} op dezelfde dag`;
  }
  zinnen.push(
    `${cap(naam)} tot nu toe **${formatEuro(m.revenue)}** gewonnen uit ${m.count} ${m.count === 1 ? 'offerte' : 'offertes'}${tempo}.`,
  );

  // 2. Het maanddoel, tegen het deel van de maand dat voorbij is.
  if (m.goals.revenue) {
    const behaald = m.revenue / m.goals.revenue;
    const verstreken = m.day / m.daysInMonth;
    const oordeel =
      behaald >= verstreken + 0.05 ? 'loopt voor op schema' : behaald <= verstreken - 0.1 ? 'loopt achter op schema' : 'ligt op schema';
    const nodig = Math.max(0, m.goals.revenue - m.revenue);
    const dagenOver = m.daysInMonth - m.day;
    zinnen.push(
      `Dat is **${formatPercent(Math.round(behaald * 100))}** van het maanddoel van ${formatEuro(m.goals.revenue)} terwijl de maand voor ${formatPercent(Math.round(verstreken * 100))} om is: het ${oordeel}.` +
        (nodig > 0 && dagenOver > 0 ? ` Nog ${formatEuro(nodig)} te gaan in ${dagenOver} ${dagenOver === 1 ? 'dag' : 'dagen'}.` : ''),
    );
  }

  // 3. Marge: alleen iets zeggen als het meer dan twee procentpunt beweegt.
  if (i.marginPct != null && i.prevMarginPct != null) {
    const d = i.marginPct - i.prevMarginPct;
    zinnen.push(
      Math.abs(d) < 2
        ? `De marge houdt stand op **${formatPercent(i.marginPct)}**.`
        : d > 0
          ? `De marge stijgt naar **${formatPercent(i.marginPct)}** (was ${formatPercent(i.prevMarginPct)}).`
          : `De marge zakt naar **${formatPercent(i.marginPct)}** (was ${formatPercent(i.prevMarginPct)}) — kijk op Marge welke offertes dat doen.`,
    );
  }

  // 4. Break-even: wat er gefactureerd moet worden om quitte te spelen.
  if (i.breakEven) {
    const b = i.breakEven;
    const gehaald = b.invoicedThisMonth >= b.revenueNeeded;
    zinnen.push(
      gehaald
        ? `De vaste lasten van deze maand zijn gedekt: er is **${formatEuro(b.invoicedThisMonth)}** gefactureerd, het break-evenpunt ligt op ${formatEuro(b.revenueNeeded)}.`
        : `Om quitte te spelen is **${formatEuro(b.revenueNeeded)}** omzet per maand nodig; er is deze maand ${formatEuro(b.invoicedThisMonth)} gefactureerd.`,
    );
  }

  // 5. Geld dat te laat is.
  if (i.overdue.count > 0) {
    zinnen.push(
      `Er staat **${formatEuro(i.overdue.amount)}** over de vervaldatum, verdeeld over ${i.overdue.count} ${i.overdue.count === 1 ? 'factuur' : 'facturen'}.`,
    );
  }

  return zinnen;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
