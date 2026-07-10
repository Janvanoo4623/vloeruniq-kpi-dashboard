import { getSnapshot, getMeta } from '@/lib/db';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [snapshot, meta] = await Promise.all([getSnapshot(), getMeta()]);
  return <Dashboard snapshot={snapshot} meta={meta} />;
}
