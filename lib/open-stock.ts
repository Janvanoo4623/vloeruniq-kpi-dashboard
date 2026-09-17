// De openstaande stapel over tijd: hoeveel offertes stonden er aan het eind
// van elke week nog open, voor hoeveel geld, en hoe oud waren ze gemiddeld.
//
// Dit is géén statusgeschiedenis (die hebben we niet), maar hij is exact te
// reconstrueren: een offerte stond op moment t open als hij vóór t is gemaakt
// en op t nog geen beslisdatum had. De beslisdatum is de datum van accepteren,
// weigeren of verlopen — zie QuotationRow.dateAccepted.
//
// Vraag van Jasper (2026-09-17): zien of de stapel groeit of slinkt, en of hij
// veroudert — "hangt er nog een rits van drie maanden geleden?".
import { getISOWeek } from './teamleader/dates';
import type { QuotationRow } from './types';

export interface OpenStockPoint {
  week: string; // "2026-W37"
  /** Laatste dag van de week (zondag), YYYY-MM-DD — het meetmoment. */
  date: string;
  count: number;
  value: number; // € ex btw
  avgAgeDays: number | null;
  /** Aantal dat op dat moment al ouder was dan 60 dagen. */
  olderThan60: number;
}

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().split('T')[0];

/** De zondagen (weekeinden) van `from` t/m `to`, plus de dag `to` zelf als hij geen zondag is. */
function weekEnds(from: string, to: string): string[] {
  const out: string[] = [];
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return out;
  // Eerste zondag op of na `from`.
  const d = new Date(start);
  const dow = d.getUTCDay(); // 0 = zondag
  let t = start + ((7 - dow) % 7) * DAY;
  for (; t <= end; t += 7 * DAY) out.push(iso(t));
  if (out[out.length - 1] !== to) out.push(to);
  return out;
}

export function openStockSeries(quotations: QuotationRow[], from: string, to: string): OpenStockPoint[] {
  const rows = quotations.filter((q) => q.dateCreated);
  return weekEnds(from, to).map((date) => {
    const t = Date.parse(date);
    let count = 0;
    let value = 0;
    let age = 0;
    let olderThan60 = 0;
    for (const q of rows) {
      if (q.dateCreated > date) continue;
      // Beslist vóór of op het meetmoment → toen niet meer open. Een offerte
      // die nu nog 'open' is heeft geen beslisdatum en telt altijd mee.
      if (q.status !== 'open' && q.dateAccepted && q.dateAccepted <= date) continue;
      count += 1;
      value += q.revenueExVat;
      const days = Math.round((t - Date.parse(q.dateCreated)) / DAY);
      age += days;
      if (days > 60) olderThan60 += 1;
    }
    return {
      week: getISOWeek(date),
      date,
      count,
      value: Math.round(value * 100) / 100,
      avgAgeDays: count > 0 ? Math.round((age / count) * 10) / 10 : null,
      olderThan60,
    };
  });
}
