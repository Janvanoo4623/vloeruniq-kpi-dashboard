import { getSnapshot, getMeta, getAllInvoices, getAllQuotations } from '@/lib/db';
import { computeAging } from '@/lib/teamleader/invoices';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [snapshot, meta, invoices, quotations] = await Promise.all([
    getSnapshot(),
    getMeta(),
    getAllInvoices(),
    getAllQuotations(),
  ]);
  const today = new Date().toISOString().split('T')[0];
  const aging = computeAging(invoices, today, quotations);
  return <Dashboard snapshot={snapshot} meta={meta} aging={aging} />;
}
