// Display formatters (Dutch locale).

const eur0 = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
const eur2 = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const num0 = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 });

export const formatEuro = (v: number | null | undefined, decimals = false): string =>
  v == null ? '—' : (decimals ? eur2 : eur0).format(v);

/** Compact euro for dense tables: € 299k, € 27,3k, € 525. */
export const formatEuroCompact = (v: number | null | undefined): string => {
  if (v == null) return '—';
  const abs = Math.abs(v);
  if (abs >= 100_000) return `€ ${num0.format(Math.round(v / 1000))}k`;
  if (abs >= 1000) return `€ ${num1.format(v / 1000)}k`;
  return `€ ${num0.format(Math.round(v))}`;
};

export const formatNumber = (v: number | null | undefined): string =>
  v == null ? '—' : num0.format(v);

export const formatPercent = (v: number | null | undefined): string =>
  v == null ? '—' : `${num1.format(v)}%`;

export const formatDays = (v: number | null | undefined): string =>
  v == null ? '—' : `${num1.format(v)} d`;

/**
 * Fold spelling variants of the same product into one canonical code, so e.g.
 * "wide board warm natural" and "wide board warm naturel" aggregate together.
 */
export function canonicalProduct(code: string): string {
  return code.replace(/natural/gi, 'naturel');
}

/**
 * Tidy a product label for display: P-numbers uppercased ("p425" -> "P425"),
 * everything else Title Cased ("herringbone warm naturel" -> "Herringbone Warm
 * Naturel"), while preserving existing all-caps tokens like "VT".
 */
export function formatProduct(p: string): string {
  const trimmed = p.trim();
  if (/^p\d{3}$/i.test(trimmed)) return trimmed.toUpperCase();
  return trimmed
    .split(/\s+/)
    .map((w) =>
      w.length > 1 && w === w.toUpperCase()
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(' ');
}

/** "2026-W25" -> "W25" for compact axis labels. */
export const shortWeek = (week: string): string => week.split('-W').map((p, i) => (i === 1 ? `W${p}` : p))[1] ?? week;

/** Relative "x minutes ago" style, Dutch. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'nooit';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'zojuist';
  if (mins < 60) return `${mins} min geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.floor(hours / 24);
  return `${days} dag${days === 1 ? '' : 'en'} geleden`;
}

/** Absolute timestamp in nl-NL. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('nl-NL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
