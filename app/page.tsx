import { store } from '@/lib/store';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [snapshot, meta] = await Promise.all([store.getSnapshot(), store.getMeta()]);
  return <Dashboard snapshot={snapshot} meta={meta} />;
}
