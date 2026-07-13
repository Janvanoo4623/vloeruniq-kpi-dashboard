import { getSnapshot, getMeta, getAllInvoices, getAllQuotations, getCurrentPrices } from '@/lib/db';
import { computeAging } from '@/lib/teamleader/invoices';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [snapshot, meta, invoices, quotations, prices] = await Promise.all([
    getSnapshot(),
    getMeta(),
    getAllInvoices(),
    getAllQuotations(),
    getCurrentPrices(),
  ]);
  const today = new Date().toISOString().split('T')[0];
  const aging = computeAging(invoices, today, quotations);
  const pricedCodes = prices.map((p) => p.code.toLowerCase());
  return <Dashboard snapshot={snapshot} meta={meta} aging={aging} pricedCodes={pricedCodes} />;
}
