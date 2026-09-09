import { getAllQuotations, getAllDeals, getResolveInput } from '@/lib/db';
import { resolveQuotations } from '@/lib/resolve';
import { leadSourceTrend } from '@/lib/insights';
import LeadbronnenView from '@/components/pages/LeadbronnenView';

export const dynamic = 'force-dynamic';

/**
 * Het verloop gaat over álle offertes, niet over de gekozen periode — anders zie
 * je geen verschuiving maar alleen het laatste kwartaal.
 */
export default async function LeadbronnenPage() {
  const [quotations, deals, resolveInput] = await Promise.all([
    getAllQuotations(),
    getAllDeals(),
    getResolveInput(),
  ]);
  const resolved = resolveQuotations(quotations, resolveInput);
  return <LeadbronnenView trend={leadSourceTrend(resolved, deals)} />;
}
