import {
  getSnapshot,
  getMeta,
  getAllInvoices,
  getAllQuotations,
  getCurrentPrices,
  getExclusions,
  getOverrides,
} from '@/lib/db';
import { computeAging } from '@/lib/teamleader/invoices';
import { computePipeline } from '@/lib/pipeline';
import { computePaymentStats } from '@/lib/payments';
import { applyOverrides, applyOverridesToSnapshot } from '@/lib/overrides';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [snapshot, meta, invoices, quotations, prices, exclusions, overrides] = await Promise.all([
    getSnapshot(),
    getMeta(),
    getAllInvoices(),
    getAllQuotations(),
    getCurrentPrices(),
    getExclusions(),
    getOverrides(),
  ]);
  const today = new Date().toISOString().split('T')[0];
  // Apply per-quotation corrections at read time (instant + retroactive).
  const resolvedQuotations = applyOverrides(quotations, overrides);
  const resolvedSnapshot = snapshot ? applyOverridesToSnapshot(snapshot, overrides) : null;
  const aging = computeAging(invoices, today, resolvedQuotations);
  const pipeline = computePipeline(resolvedQuotations, exclusions, today);
  const payments = computePaymentStats(invoices, today);
  const pricedCodes = prices.map((p) => p.code.toLowerCase());
  return (
    <Dashboard
      snapshot={resolvedSnapshot}
      meta={meta}
      aging={aging}
      pipeline={pipeline}
      payments={payments}
      pricedCodes={pricedCodes}
    />
  );
}
