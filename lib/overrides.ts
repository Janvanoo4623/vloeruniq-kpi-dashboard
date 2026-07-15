// Apply per-quotation manual corrections (feedback 2026-07-13) at READ time, so
// they take effect instantly and retroactively without a re-sync:
//   * a per-line special purchase price (€/m²) for a one-off deal;
//   * an offerte-level "los verkocht — geen legservice" flag (drop labour cost).
//
// Only quotations that HAVE an override are recomputed; every other quotation is
// returned untouched (its synced margins are preserved byte-for-byte). Margins
// are recomputed from the per-line cost components stored at sync time
// (purchasePerM2/gluedPerM2/laborPerM2). Rows synced before those existed fall
// back to the default constant rates + a glued check on the line description —
// approximate until the quotation is re-synced, exact after. See DATA-MODEL.md.
import {
  LABOR_COST_PER_M2,
  PRIMER_COST_PER_M2,
  GLUE_COST_PER_M2,
  LEVELING_COST_PER_M2,
} from './teamleader/constants';
import { buildSnapshot } from './teamleader/aggregate';
import type { AggLine } from './teamleader/quotations';
import type { QuotationLine, QuotationOverride, QuotationRow, Snapshot } from './types';

const round2 = (v: number) => Math.round(v * 100) / 100;
const round1 = (v: number) => Math.round(v * 10) / 10;
const DEFAULT_GLUED = PRIMER_COST_PER_M2 + GLUE_COST_PER_M2 + LEVELING_COST_PER_M2;

/** Resolve a line's cost components, falling back to constants for old rows. */
function components(l: QuotationLine): { purchase: number | null; glued: number; labor: number } {
  const glued = l.gluedPerM2 ?? (l.desc?.toLowerCase().includes('lijmen') ? DEFAULT_GLUED : 0);
  const labor = l.laborPerM2 ?? LABOR_COST_PER_M2;
  // Base purchase: stored component, else derive from the frozen margin if priced.
  let purchase: number | null = l.purchasePerM2 ?? null;
  if (purchase == null && l.margin != null && l.m2 > 0) {
    purchase = (l.revenue - l.margin) / l.m2 - glued - labor;
  }
  return { purchase, glued, labor };
}

/** Recompute one quotation under an override. `omzetVloer` (floor revenue) is unchanged. */
function recompute(q: QuotationRow, ov: QuotationOverride): QuotationRow {
  const lines = q.lines ?? [];
  let material = 0;
  let laborTotal = 0;
  let m2WithMatch = 0;
  let hasMatch = false;

  const newLines: QuotationLine[] = lines.map((l) => {
    const c = components(l);
    const override = ov.prices[l.code.toLowerCase()];
    const purchase = override != null ? override : c.purchase;
    if (purchase == null) return { ...l, margin: null }; // still unpriced
    const matPerM2 = purchase + c.glued;
    const labor = ov.noLabor ? 0 : c.labor;
    material += matPerM2 * l.m2;
    laborTotal += labor * l.m2;
    m2WithMatch += l.m2;
    hasMatch = true;
    return { ...l, margin: round2(l.revenue - (matPerM2 + labor) * l.m2) };
  });

  if (!hasMatch || m2WithMatch <= 0) {
    return { ...q, lines: newLines, cost: null, margin: null, marginPct: null };
  }
  const finalCost = material + laborTotal;
  const margin = round2(q.omzetVloer - finalCost);
  const marginPct = q.omzetVloer > 0 ? round1((margin / q.omzetVloer) * 100) : null;
  const matchCoverage = q.totalM2 > 0 ? round1((m2WithMatch / q.totalM2) * 100) : null;
  return {
    ...q,
    lines: newLines,
    cost: round2(finalCost),
    margin,
    marginPct,
    matchCoverage,
    verified: matchCoverage === 100 && margin != null,
  };
}

/** Apply overrides to a list of quotations; untouched rows are returned as-is. */
export function applyOverrides(
  rows: QuotationRow[],
  overrides: Record<string, QuotationOverride>,
): QuotationRow[] {
  if (!overrides || Object.keys(overrides).length === 0) return rows;
  return rows.map((q) => {
    const ov = overrides[q.id];
    if (!ov || (!ov.noLabor && Object.keys(ov.prices).length === 0)) return q;
    return recompute(q, ov);
  });
}

/**
 * Rebuild a cached snapshot with overrides applied to its quotations, so the
 * initial dashboard view reflects corrections too. No-op when there are none.
 */
export function applyOverridesToSnapshot(
  snapshot: Snapshot,
  overrides: Record<string, QuotationOverride>,
): Snapshot {
  if (!overrides || Object.keys(overrides).length === 0) return snapshot;
  const q = applyOverrides(snapshot.quotations, overrides);
  const lines: AggLine[] = q.flatMap((x) =>
    (x.lines ?? []).map((l) => ({ ...l, status: x.status, quotationId: x.id })),
  );
  return buildSnapshot(q, snapshot.runTimeRows, lines, snapshot.invoicing, snapshot.lookbackDays, snapshot.generatedAt);
}
