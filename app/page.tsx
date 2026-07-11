import { getSnapshot, getMeta, getAllInvoices } from '@/lib/db';
import { computeAging } from '@/lib/teamleader/invoices';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [snapshot, meta, invoices] = await Promise.all([getSnapshot(), getMeta(), getAllInvoices()]);
  const today = new Date().toISOString().split('T')[0];
  const aging = computeAging(invoices, today);
  return <Dashboard snapshot={snapshot} meta={meta} aging={aging} />;
}
