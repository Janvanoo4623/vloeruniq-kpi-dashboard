import {
  getSnapshot,
  getMeta,
  getAllInvoices,
  getAllQuotations,
  getCurrentPrices,
  getExclusions,
} from '@/lib/db';
import { computeAging } from '@/lib/teamleader/invoices';
import { computePipeline } from '@/lib/pipeline';
import { computePaymentStats } from '@/lib/payments';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [snapshot, meta, invoices, quotations, prices, exclusions] = await Promise.all([
    getSnapshot(),
    getMeta(),
    getAllInvoices(),
    getAllQuotations(),
    getCurrentPrices(),
    getExclusions(),
  ]);
  const today = new Date().toISOString().split('T')[0];
  const aging = computeAging(invoices, today, quotations);
  const pipeline = computePipeline(quotations, exclusions, today);
  const payments = computePaymentStats(invoices, today);
  const pricedCodes = prices.map((p) => p.code.toLowerCase());
  return (
    <Dashboard
      snapshot={snapshot}
      meta={meta}
      aging={aging}
      pipeline={pipeline}
      payments={payments}
      pricedCodes={pricedCodes}
    />
  );
}
