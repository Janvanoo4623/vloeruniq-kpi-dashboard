// Weighted pipeline forecast: how much of the current open-quotation value is
// likely to become revenue. Teamleader's "refused" status is unreliable (open
// quotes are rarely marked lost), so we DON'T use accepted/(accepted+refused).
// Instead we derive a win-rate from a *matured cohort*: quotations old enough to
// have been decided. A quote still open after MATURITY_DAYS is treated as lost.
import type { QuotationRow } from './types';

/** Days after which an un-accepted quote is considered decided (effectively lost). */
const MATURITY_DAYS = 60;
/** Minimum matured quotes before we trust the win-rate. */
const MIN_SAMPLE = 10;

export interface PipelineQuote {
  quotation: QuotationRow;
  daysOpen: number;
  value: number; // revenueExVat
}

export interface PipelineAgeTier {
  label: string;
  count: number;
  value: number;
}

export interface PipelineStats {
  openValue: number; // sum revenueExVat of open quotes
  openCount: number;
  winRate: number | null; // matured-cohort acceptance (0-100), null if too little history
  expectedValue: number | null; // openValue * winRate
  maturedAccepted: number;
  maturedTotal: number; // basis for win-rate
  ageTiers: PipelineAgeTier[]; // open quotes by age: 0-30 / 31-60 / 60+
  oldestOpen: PipelineQuote[]; // oldest-open first (chase list)
}

const daysBetween = (fromIso: string, toMs: number): number =>
  Math.floor((toMs - Date.parse(fromIso)) / 86400000);

const round = (v: number): number => Math.round(v);

export function computePipeline(
  quotations: QuotationRow[],
  exclusions: Set<string>,
  asOf: string,
): PipelineStats {
  const asOfMs = Date.parse(asOf);

  let maturedAccepted = 0;
  let maturedTotal = 0;
  const tiers: PipelineAgeTier[] = [
    { label: 'Vers (0–30 d)', count: 0, value: 0 },
    { label: '31–60 d', count: 0, value: 0 },
    { label: '60+ d (risico)', count: 0, value: 0 },
  ];
  const openQuotes: PipelineQuote[] = [];
  let openValue = 0;
  let openCount = 0;

  for (const q of quotations) {
    if (exclusions.has(q.id)) continue;
    const created = q.dateCreated;
    if (!created) continue;
    const age = daysBetween(created, asOfMs);

    // Matured cohort (old enough to have been decided) → win-rate basis.
    if (age >= MATURITY_DAYS && (q.status === 'accepted' || q.status === 'open' || q.status === 'refused')) {
      maturedTotal += 1;
      if (q.status === 'accepted') maturedAccepted += 1;
    }

    if (q.status !== 'open') continue;
    openValue += q.revenueExVat;
    openCount += 1;
    const tier = age <= 30 ? 0 : age <= 60 ? 1 : 2;
    tiers[tier].count += 1;
    tiers[tier].value += q.revenueExVat;
    openQuotes.push({ quotation: q, daysOpen: age, value: q.revenueExVat });
  }

  tiers.forEach((t) => (t.value = round(t.value)));
  openQuotes.sort((a, b) => b.daysOpen - a.daysOpen);

  const winRate =
    maturedTotal >= MIN_SAMPLE ? Math.round((maturedAccepted / maturedTotal) * 1000) / 10 : null;
  const expectedValue = winRate == null ? null : round((openValue * winRate) / 100);

  return {
    openValue: round(openValue),
    openCount,
    winRate,
    expectedValue,
    maturedAccepted,
    maturedTotal,
    ageTiers: tiers,
    oldestOpen: openQuotes.slice(0, 12),
  };
}
