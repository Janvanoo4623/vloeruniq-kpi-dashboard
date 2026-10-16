import { getAllQuotations, getExclusions, getResolveInput } from '@/lib/db';
import { resolveQuotations } from '@/lib/resolve';
import { fetchMarket } from '@/lib/market';
import TrendsPage from '@/components/pages/TrendsPage';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const [quotations, resolveInput, exclusions] = await Promise.all([getAllQuotations(), getResolveInput(), getExclusions()]);
  const market = await fetchMarket(resolveQuotations(quotations, resolveInput), exclusions);
  return <TrendsPage market={market} />;
}
