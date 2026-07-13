// Payment behaviour: how fast customers pay. Uses the invoice's paid_at date
// (populated from Teamleader on sync) for an exact invoice→payment lag. Falls
// back to nulls when no paid dates are known yet (pre-migration / pre-sync).
import type { InvoiceRow } from './types';

export interface PaymentStats {
  avgDaysToPay: number | null; // exact average invoice→payment days
  medianDaysToPay: number | null;
  sampleCount: number; // paid invoices with a known paid date
  onTimePct: number | null; // % paid on/before the due date
  avgOutstandingAge: number | null; // avg days since invoice date for unpaid
  outstandingCount: number;
}

const DAY = 86400000;
const diffDays = (fromIso: string, toIso: string): number =>
  Math.max(0, Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / DAY));

export function computePaymentStats(invoices: InvoiceRow[], asOf: string): PaymentStats {
  const lags: number[] = [];
  let onTime = 0;
  let onTimeBasis = 0;
  let outstandingAgeSum = 0;
  let outstandingCount = 0;

  for (const inv of invoices) {
    if (inv.status === 'draft') continue;

    if (inv.paid && inv.paidAt && inv.invoiceDate) {
      lags.push(diffDays(inv.invoiceDate, inv.paidAt));
      if (inv.dueOn) {
        onTimeBasis += 1;
        if (Date.parse(inv.paidAt) <= Date.parse(inv.dueOn)) onTime += 1;
      }
    } else if (!inv.paid && inv.dueIncl > 0 && inv.invoiceDate) {
      outstandingAgeSum += diffDays(inv.invoiceDate, asOf);
      outstandingCount += 1;
    }
  }

  const avg = lags.length ? Math.round(lags.reduce((s, d) => s + d, 0) / lags.length) : null;
  let median: number | null = null;
  if (lags.length) {
    const sorted = [...lags].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    median =
      sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
  }

  return {
    avgDaysToPay: avg,
    medianDaysToPay: median,
    sampleCount: lags.length,
    onTimePct: onTimeBasis ? Math.round((onTime / onTimeBasis) * 1000) / 10 : null,
    avgOutstandingAge: outstandingCount ? Math.round(outstandingAgeSum / outstandingCount) : null,
    outstandingCount,
  };
}
