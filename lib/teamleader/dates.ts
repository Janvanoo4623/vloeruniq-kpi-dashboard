// Date helpers, ported faithfully from the Apps Script so week labels and
// month/quarter/year derivations match the existing Google Sheet.

import { DAYS_LOOKBACK } from './constants';

/** Cutoff date (YYYY-MM-DD), `DAYS_LOOKBACK` days before `now`. */
export function getCutoffDate(now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - DAYS_LOOKBACK);
  return d.toISOString().split('T')[0];
}

/** "YYYY-MM-DD" from an ISO datetime string, or '' if absent. */
export function dateOnly(iso: string | undefined | null): string {
  return iso ? iso.split('T')[0] : '';
}

/**
 * ISO-week label "YYYY-Www", ported from the Apps Script's getISOWeek.
 * Uses UTC methods for deterministic results regardless of server timezone.
 */
export function getISOWeek(dateStr: string): string {
  const date = new Date(dateStr);
  const dayOfWeek = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayOfWeek);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const weekNum = Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${weekNum}`;
}

/** Sort ISO-week labels descending (newest first). */
export function compareWeeksDesc(a: string, b: string): number {
  const [yearA, weekA] = a.split('-W').map(Number);
  const [yearB, weekB] = b.split('-W').map(Number);
  if (yearA !== yearB) return yearB - yearA;
  return weekB - weekA;
}

/** month "YYYY-MM", quarter "Qn YYYY", year "YYYY" from a YYYY-MM-DD string. */
export function deriveDateParts(date: string): {
  month: string;
  quarter: string;
  year: string;
} {
  if (!date) return { month: '', quarter: '', year: '' };
  const month = date.substring(0, 7);
  const year = date.substring(0, 4);
  const monthNum = parseInt(date.substring(5, 7), 10);
  const quarter = `Q${Math.ceil(monthNum / 3)} ${year}`;
  return { month, quarter, year };
}

/** Round to n decimals (default 2), matching the script's Math.round style. */
export function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
