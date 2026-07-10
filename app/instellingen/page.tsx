import { getCurrentPrices, getCurrentCosts, listExclusions } from '@/lib/db';
import Settings from '@/components/Settings';

export const dynamic = 'force-dynamic';

export default async function InstellingenPage() {
  const [prices, costs, exclusions] = await Promise.all([
    getCurrentPrices(),
    getCurrentCosts(),
    listExclusions(),
  ]);
  return <Settings initial={{ prices, costs, exclusions }} />;
}
